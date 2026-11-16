import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { publishNotification } from "@/features/notifications/send-push-helper";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { SUPERVISOR_IMPORT_DAILY_MAX, SUPERVISOR_IMPORT_MAX, parseContactList, planShares, type ReviewedContact } from "./parse-contacts";

/**
 * Lista interna da equipe (16/11/2026, ideia de uma supervisora): o supervisor importa até 50 contatos, eles ficam só
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

/** Leads que o supervisor importou e ainda não distribuiu ("Para distribuir"). */
export async function listPendingSupervisorLeads(context: TenantContext) {
  if (context.role !== "supervisor") return [];
  return getDatabase()
    .select({ id: schema.leads.id, name: schema.leads.nome, phone: schema.leads.telefone, email: schema.leads.email, createdAt: schema.leads.createdAt })
    .from(schema.leads)
    .where(and(ownImport(context), isNull(schema.leads.corretorId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
    .orderBy(asc(schema.leads.createdAt))
    .limit(500);
}

/** Telefones (últimos 11 dígitos) que já existem na empresa. */
async function existingPhones(tenantId: string, phones: string[]) {
  if (!phones.length) return new Set<string>();
  const tails = phones.map((phone) => phone.slice(-11));
  const rows = await getDatabase()
    .select({ tail: sql<string>`right(regexp_replace(${schema.leads.telefone}, '\\D', '', 'g'), 11)` })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt), inArray(sql`right(regexp_replace(${schema.leads.telefone}, '\\D', '', 'g'), 11)`, tails)));
  return new Set(rows.map((row) => row.tail));
}

/** Passo "Conferir": organiza a lista e marca o que já está no sistema. Não grava nada. */
export async function reviewSupervisorList(context: TenantContext, text: string) {
  await assertSupervisor(context);
  const parsed = parseContactList(text);
  const known = await existingPhones(context.tenantId, parsed.contacts.flatMap((contact) => (contact.phone && !contact.problem ? [contact.phone] : [])));
  const contacts: ReviewedContact[] = parsed.contacts.map((contact) => ({
    ...contact,
    duplicate: Boolean(contact.phone && !contact.problem && known.has(contact.phone.slice(-11))),
  }));
  return { contacts, overflow: parsed.overflow };
}

/** Grava os contatos prontos como leads da equipe, sem dono e fora de qualquer distribuição automática. */
export async function importSupervisorContacts(context: TenantContext, input: { contacts: Array<{ name: string; phone: string; email: string | null }>; consent: boolean }) {
  await assertSupervisor(context);
  if (!input.consent) throw new SupervisorImportError("Confirme que você tem autorização para contatar essas pessoas.");
  // O servidor relê cada contato: nunca confia no que a tela mandou.
  const clean = input.contacts.slice(0, SUPERVISOR_IMPORT_MAX).flatMap((contact) => {
    const parsed = parseContactList(`${contact.name} ${contact.phone} ${contact.email ?? ""}`).contacts[0];
    return parsed?.phone && !parsed.problem ? [{ name: parsed.name, phone: parsed.phone, email: parsed.email }] : [];
  });
  if (!clean.length) throw new SupervisorImportError("Nenhum contato pronto para importar.");

  const db = getDatabase();
  const [today] = await db.select({ total: count() }).from(schema.leads).where(and(ownImport(context), gte(schema.leads.createdAt, new Date(Date.now() - 24 * 3_600_000))));
  const room = SUPERVISOR_IMPORT_DAILY_MAX - Number(today?.total ?? 0);
  if (room <= 0) throw new SupervisorImportError(`Você já importou ${SUPERVISOR_IMPORT_DAILY_MAX} contatos nas últimas 24 horas. Tente amanhã.`);

  const known = await existingPhones(context.tenantId, clean.map((contact) => contact.phone));
  const fresh = clean.filter((contact) => !known.has(contact.phone.slice(-11))).slice(0, room);
  const importId = randomUUID();
  const now = new Date();
  const created: Array<{ id: string; name: string }> = [];
  if (fresh.length) {
    await db.transaction(async (tx) => {
      for (const contact of fresh) {
        const leadId = randomUUID();
        await tx.insert(schema.leads).values({
          id: leadId,
          tenantId: context.tenantId,
          branchId: context.branchId,
          corretorId: null,
          queueId: null,
          nome: contact.name,
          telefone: contact.phone,
          email: contact.email,
          origem: "manual",
          tipo: "PF",
          sourceChannel: SUPERVISOR_IMPORT_SOURCE,
          sourceCampaign: "Lista da equipe",
          sourceMetadata: { import: "supervisor_list", importId, supervisorId: context.userId },
          status: "new",
          qualificationStatus: "qualified",
          qualificationState: "COMPLETED",
          // Fora da distribuição automática e do plantão: só sai pelo botão Distribuir do supervisor.
          distributionStatus: HELD_STATUS,
          distributionUpdatedAt: now,
          // Lista sem prova de consentimento: nunca registrar um (LGPD art. 8 §2), como na importação do diretor.
          consentimentoLgpd: false,
        });
        await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId, userId: context.userId, tipo: "note", conteudo: "Lead importado pelo supervisor na lista interna da equipe." });
        created.push({ id: leadId, name: contact.name });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId, acao: "lead.supervisor_imported", metadata: { importId } });
      }
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "supervisor_import", entidadeId: importId, acao: "supervisor_import.created",
        metadata: { sent: input.contacts.length, imported: fresh.length, duplicates: clean.length - fresh.length },
      });
    });
  }
  return { imported: created.length, duplicates: clean.length - fresh.length, importId, leads: created };
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
 * escolhida. Atribuição direta, sem mensagem para o cliente, sem WhatsApp ao corretor e sem prazo de SLA (lista fria).
 */
export async function distributeSupervisorLeads(context: TenantContext, input: { leadIds: string[]; brokerIds: string[]; counts?: Record<string, number> }) {
  await assertSupervisor(context);
  const team = await listSupervisorTeamBrokers(context);
  const teamIds = new Set(team.map((broker) => broker.id));
  const brokerIds = [...new Set(input.brokerIds)].filter((id) => teamIds.has(id));
  if (!brokerIds.length || brokerIds.length !== new Set(input.brokerIds).size) throw new SupervisorImportError("Escolha corretores da sua equipe.");

  const db = getDatabase();
  const pending = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(ownImport(context), isNull(schema.leads.corretorId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), inArray(schema.leads.id, input.leadIds.slice(0, 500))))
    .orderBy(asc(schema.leads.createdAt));
  if (!pending.length) throw new SupervisorImportError("Esses leads já foram distribuídos. Atualize a página.");

  const { shares } = planShares(pending.length, brokerIds, input.counts);
  const now = new Date();
  const received = new Map<string, number>();
  let cursor = 0;
  await db.transaction(async (tx) => {
    for (const share of shares) {
      for (const lead of pending.slice(cursor, cursor + share.count)) {
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
        }).where(and(eq(schema.leads.id, lead.id), ownImport(context), isNull(schema.leads.corretorId))).returning({ id: schema.leads.id });
        if (!updated.length) continue;
        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(), tenantId: context.tenantId, leadId: lead.id, fromBranchId: context.branchId, toBranchId: context.branchId,
          fromQueueId: null, toQueueId: null, previousOwnerId: null, newOwnerId: share.brokerId, action: "assigned",
          source: "manual_supervisor", strategy: "manual", reason: "Lista interna da equipe", actorId: context.userId,
          metadata: { assignmentScope: "supervisor_team_list" }, createdAt: now,
        });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_distribution", entidadeId: lead.id, acao: "lead.assigned", metadata: { source: "manual_supervisor", brokerId: share.brokerId } });
        received.set(share.brokerId, (received.get(share.brokerId) ?? 0) + 1);
      }
      cursor += share.count;
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
  return { distributed, left: pending.length - distributed, perBroker: Object.fromEntries(received) };
}
