import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { lerTelefone } from "@/shared/input/telefone";

import { EMAIL, SUPERVISOR_IMPORT_CHUNK, SUPERVISOR_IMPORT_WEEKLY_MAX, buildContact, cleanName, planShares, titleCase } from "./parse-contacts";

/**
 * Lista interna da equipe (16/11/2026, ideia de uma supervisora): o supervisor importa a lista (até 5.000 por semana), eles ficam só
 * com ele (sem dono, fora da distribuição automática e do plantão) e vão para os corretores da equipe dele apenas
 * quando ele toca em Distribuir. A marca fica em `source_metadata` (sem migration): `sourceChannel` = SOURCE e
 * `supervisorId` = quem importou.
 */
export const SUPERVISOR_IMPORT_SOURCE = "supervisor_import";
const HELD_STATUS = "manual_hold";

export class SupervisorImportError extends Error {}

export async function isSupervisorImportEnabled() {
  return (await getFeatureFlag(FEATURE_FLAGS.SUPERVISOR_LEAD_IMPORT)) === "true";
}

async function assertSupervisor(context: TenantContext) {
  if (context.role !== "supervisor") throw new SupervisorImportError("Só o supervisor importa a lista da equipe.");
  if (!context.branchId) throw new SupervisorImportError("Seu cadastro está sem unidade. Fale com a direção.");
  if (!(await isSupervisorImportEnabled())) throw new SupervisorImportError("A importação de lista da equipe está desligada.");
}

/** Corretores ativos da equipe do supervisor, na unidade dele. */
export async function listSupervisorTeamBrokers(context: TenantContext) {
  return getDatabase()
    .select({ id: schema.user.id, name: schema.user.name, image: schema.user.image, availability: schema.tenantMemberships.availabilityStatus })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.supervisorId, context.userId),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.role, "broker"),
      context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : undefined,
      eq(schema.user.active, true),
    ))
    .orderBy(asc(schema.user.name));
}

const ownImport = (context: TenantContext) => and(
  eq(schema.leads.tenantId, context.tenantId),
  eq(schema.leads.sourceChannel, SUPERVISOR_IMPORT_SOURCE),
  sql`${schema.leads.sourceMetadata}->>'supervisorId' = ${context.userId}`,
);

const pendingWhere = (context: TenantContext) => and(ownImport(context), isNull(schema.leads.corretorId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt));

/** Quantos leads o supervisor importou e ainda não distribuiu ("Para distribuir"). Só a contagem. */
export async function countPendingSupervisorLeads(context: TenantContext) {
  if (context.role !== "supervisor") return 0;
  const [row] = await getDatabase().select({ total: count() }).from(schema.leads).where(pendingWhere(context));
  return Number(row?.total ?? 0);
}

/** Telefones (últimos 11 dígitos) que já existem na empresa. Uma consulta, para a lista inteira. */
async function existingPhones(tenantId: string, phones: string[]) {
  if (!phones.length) return new Set<string>();
  const tails = [...new Set(phones.map((phone) => phone.replace(/\D/g, "").slice(-11)))];
  const tail = sql<string>`right(regexp_replace(${schema.leads.telefone}, '\\D', '', 'g'), 11)`;
  const rows = await getDatabase()
    .selectDistinct({ tail })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt), inArray(tail, tails)));
  return new Set(rows.map((row) => row.tail));
}

/** Quantos o supervisor ainda pode importar nesta semana (7 dias corridos). */
async function weekRoom(context: TenantContext) {
  const [row] = await getDatabase().select({ total: count() }).from(schema.leads).where(and(ownImport(context), gte(schema.leads.createdAt, new Date(Date.now() - 7 * 24 * 3_600_000))));
  return Math.max(0, SUPERVISOR_IMPORT_WEEKLY_MAX - Number(row?.total ?? 0));
}

/**
 * Passo "Conferir": a tela já organizou a lista; aqui é UMA busca no banco para saber quais celulares já estão
 * no CRM, mais quanto ainda cabe na semana. Não grava nada.
 */
export async function reviewSupervisorList(context: TenantContext, phones: string[]) {
  await assertSupervisor(context);
  const clean = phones.flatMap((phone) => {
    const read = lerTelefone(phone);
    return read.ok && read.celular ? [read.e164] : [];
  });
  const known = await existingPhones(context.tenantId, clean);
  return { known: clean.filter((phone) => known.has(phone.slice(-11))), weekLeft: await weekRoom(context) };
}

/**
 * Grava um bloco da lista (até SUPERVISOR_IMPORT_CHUNK) como leads da equipe, sem dono e fora de qualquer
 * distribuição automática. Gravação em bloco: 3 comandos por bloco, não 3 por lead.
 */
export async function importSupervisorContacts(context: TenantContext, input: { importId: string; consent: boolean; contacts: Array<{ name: string; phone: string; email: string | null; note: string | null }> }) {
  await assertSupervisor(context);
  if (!input.consent) throw new SupervisorImportError("Confirme que você tem autorização para contatar essas pessoas.");
  // O servidor relê cada contato: nunca confia no que a tela mandou.
  const seen = new Set<string>();
  const clean = input.contacts.slice(0, SUPERVISOR_IMPORT_CHUNK).flatMap((draft) => {
    const contact = buildContact({ line: 0, name: titleCase(cleanName(draft.name)), phoneRaw: draft.phone, email: draft.email?.match(EMAIL)?.[0]?.toLowerCase() ?? null, note: draft.note });
    if (!contact.phone || contact.problem || seen.has(contact.phone)) return [];
    seen.add(contact.phone);
    return [contact];
  });
  if (!clean.length) throw new SupervisorImportError("Nenhum contato pronto para importar.");

  const room = await weekRoom(context);
  if (room <= 0) throw new SupervisorImportError(`Você já importou ${SUPERVISOR_IMPORT_WEEKLY_MAX.toLocaleString("pt-BR")} contatos nos últimos 7 dias. Dá para importar de novo quando a semana virar.`);

  const known = await existingPhones(context.tenantId, clean.map((contact) => contact.phone!));
  const fresh = clean.filter((contact) => !known.has(contact.phone!.slice(-11))).slice(0, room);
  if (fresh.length) {
    const now = new Date();
    const rows = fresh.map((contact) => ({ contact, leadId: randomUUID() }));
    await getDatabase().transaction(async (tx) => {
      await tx.insert(schema.leads).values(rows.map(({ contact, leadId }) => ({
        id: leadId,
        tenantId: context.tenantId,
        branchId: context.branchId,
        corretorId: null,
        queueId: null,
        nome: contact.name,
        telefone: contact.phone!,
        email: contact.email,
        origem: "manual" as const,
        tipo: "PF" as const,
        sourceChannel: SUPERVISOR_IMPORT_SOURCE,
        sourceCampaign: "Lista da equipe",
        sourceMetadata: { import: "supervisor_list", importId: input.importId, supervisorId: context.userId },
        status: "new" as const,
        qualificationStatus: "qualified" as const,
        qualificationState: "COMPLETED" as const,
        // Fora da distribuição automática e do plantão: só sai pelo botão Distribuir do supervisor.
        distributionStatus: HELD_STATUS,
        distributionUpdatedAt: now,
        // Lista sem prova de consentimento: nunca registrar um (LGPD art. 8 §2), como na importação do diretor.
        consentimentoLgpd: false,
      })));
      await tx.insert(schema.leadInteractions).values(rows.map(({ contact, leadId }) => ({
        id: randomUUID(),
        leadId,
        userId: context.userId,
        tipo: "note" as const,
        conteudo: contact.note ? `Lead importado pelo supervisor na lista interna da equipe.\nDa planilha: ${contact.note}` : "Lead importado pelo supervisor na lista interna da equipe.",
      })));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "supervisor_import", entidadeId: input.importId, acao: "supervisor_import.created",
        metadata: { sent: input.contacts.length, imported: fresh.length, duplicates: clean.length - fresh.length, leadIds: rows.map((row) => row.leadId) },
      });
    });
  }
  return { imported: fresh.length, duplicates: clean.length - fresh.length };
}

/** Texto do aviso no CRM (sem WhatsApp, pedido do Vinicios em 16/11). */
export function teamListNotice(received: number) {
  const leads = received === 1 ? "O lead que veio para você já está" : `Os ${received} leads que vieram para você já estão`;
  return {
    title: "Lista interna da equipe",
    message: `Sua supervisão importou uma lista de leads interna da equipe. ${leads} na área de leads do seu CRM.`,
  };
}

/**
 * Botão Distribuir: entrega os leads pendentes do supervisor para os corretores da equipe dele, na quantidade
 * escolhida (os mais antigos primeiro). Atribuição direta, sem mensagem para o cliente, sem WhatsApp ao corretor e
 * sem prazo de SLA (lista fria). Um UPDATE em bloco por corretor.
 */
export async function distributeSupervisorLeads(context: TenantContext, input: { counts: Record<string, number> }) {
  await assertSupervisor(context);
  const team = await listSupervisorTeamBrokers(context);
  const teamIds = new Set(team.map((broker) => broker.id));
  const wanted = Object.entries(input.counts).filter(([, total]) => total > 0);
  if (!wanted.length || wanted.some(([id]) => !teamIds.has(id))) throw new SupervisorImportError("Escolha corretores da sua equipe.");

  const db = getDatabase();
  const pendingTotal = await countPendingSupervisorLeads(context);
  if (!pendingTotal) throw new SupervisorImportError("Esses leads já foram distribuídos. Atualize a página.");
  const { shares } = planShares(pendingTotal, wanted.map(([id]) => id), Object.fromEntries(wanted));
  const now = new Date();
  const received = new Map<string, number>();
  await db.transaction(async (tx) => {
    for (const share of shares) {
      const pick = tx.select({ id: schema.leads.id }).from(schema.leads).where(pendingWhere(context)).orderBy(asc(schema.leads.createdAt)).limit(share.count).for("update", { skipLocked: true });
      const updated = await tx.update(schema.leads).set({
        corretorId: share.brokerId,
        status: "distributed",
        distributionStatus: "assigned",
        distributionOrigin: "unit",
        assignedAt: now,
        assignmentSource: "manual_supervisor",
        assignmentStrategy: "manual",
        distributionUpdatedAt: now,
        stageEnteredAt: now,
        updatedAt: now,
      }).where(and(inArray(schema.leads.id, pick), isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
      if (!updated.length) continue;
      await tx.insert(schema.leadDistributionEvents).values(updated.map((lead) => ({
        id: randomUUID(), tenantId: context.tenantId, leadId: lead.id, fromBranchId: context.branchId, toBranchId: context.branchId,
        fromQueueId: null, toQueueId: null, previousOwnerId: null, newOwnerId: share.brokerId, action: "assigned" as const,
        source: "manual_supervisor" as const, strategy: "manual" as const, reason: "Lista interna da equipe", actorId: context.userId,
        metadata: { assignmentScope: "supervisor_team_list" }, createdAt: now,
      })));
      received.set(share.brokerId, updated.length);
    }
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "supervisor_import", entidadeId: context.userId, acao: "supervisor_import.distributed",
      metadata: { shares: Object.fromEntries(received) },
    });
  });

  // Um aviso no CRM por corretor (push e sino), nunca pelo número oficial.
  const batch = randomUUID();
  await Promise.allSettled([...received].map(([brokerId, total]) => {
    const notice = teamListNotice(total);
    return publishNotification({
      capability: "team_list_distributed",
      tenantId: context.tenantId,
      recipientUserId: brokerId,
      type: "team_list_distributed",
      title: notice.title,
      message: notice.message,
      url: "/leads",
      tag: "corretop-leads",
      idempotencyKey: `team-list:${batch}:${brokerId}`,
    });
  }));

  const distributed = [...received.values()].reduce((sum, value) => sum + value, 0);
  return { distributed, left: pendingTotal - distributed, perBroker: Object.fromEntries(received) };
}
