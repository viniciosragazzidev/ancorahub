import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";

import { publishInAppNotification, publishNotification } from "@/features/notifications/send-push-helper";
import { cleanFirstContactHours, firstContactHoursLabel, groupExpiredImportBatches, importedFirstContactHours } from "@/features/broker-workspace/imported-first-contact";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { lerTelefone } from "@/shared/input/telefone";

import { teamListClientReplied } from "./team-list-sql";
import { cleanListName, defaultListName, uniqueListName } from "./list-names";
import { isLeadListsReady, leadListLinks } from "./list-schema";

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

export type TeamListRow = {
  id: string;
  name: string;
  phone: string;
  status: string;
  brokerId: string | null;
  brokerName: string | null;
  replied: boolean;
  createdAt: string;
  assignedAt: string | null;
  /** Lista de importação do lead (DEC-191); null antes da migration 0236. */
  listId: string | null;
};

/**
 * "Lista importada" do supervisor: tudo o que ele importou (para distribuir e já distribuído), com quem está e se
 * o cliente já respondeu. Uma consulta para as linhas (até 2.000, as mais novas) e uma para os totais.
 */
export async function listSupervisorTeamList(context: TenantContext, listId?: string | null) {
  if (context.role !== "supervisor") return { rows: [] as TeamListRow[], totals: { all: 0, pending: 0, distributed: 0, replied: 0 } };
  const db = getDatabase();
  const replied = teamListClientReplied();
  const listsReady = await isLeadListsReady();
  // Uma lista só (DEC-191): os leads dela.
  const onlyList = listsReady && listId ? eq(leadListLinks.importListId, listId) : undefined;
  const alive = and(ownImport(context), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), onlyList);
  const [rows, [totals]] = await Promise.all([
    db.select({
      id: schema.leads.id,
      name: schema.leads.nome,
      phone: schema.leads.telefone,
      status: schema.leads.status,
      brokerId: schema.leads.corretorId,
      brokerName: schema.user.name,
      replied: sql<boolean>`${replied}`,
      createdAt: schema.leads.createdAt,
      assignedAt: schema.leads.assignedAt,
      listId: listsReady ? sql<string | null>`${leadListLinks.importListId}` : sql<string | null>`null`,
    }).from(schema.leads)
      .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
      .where(alive)
      .orderBy(desc(schema.leads.createdAt))
      .limit(2000),
    db.select({
      all: count(),
      pending: sql<number>`count(*) filter (where ${schema.leads.corretorId} is null)`,
      replied: sql<number>`count(*) filter (where ${replied})`,
    }).from(schema.leads).where(alive),
  ]);
  const all = Number(totals?.all ?? 0);
  const pending = Number(totals?.pending ?? 0);
  return {
    rows: rows.map((row) => ({ ...row, replied: Boolean(row.replied), createdAt: row.createdAt.toISOString(), assignedAt: row.assignedAt?.toISOString() ?? null })),
    totals: { all, pending, distributed: all - pending, replied: Number(totals?.replied ?? 0) },
  };
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
  const [known, weekLeft, suggestedName] = await Promise.all([existingPhones(context.tenantId, clean), weekRoom(context), suggestListName(context)]);
  return { known: clean.filter((phone) => known.has(phone.slice(-11))), weekLeft, suggestedName };
}

/**
 * Grava um bloco da lista (até SUPERVISOR_IMPORT_CHUNK) como leads da equipe, sem dono e fora de qualquer
 * distribuição automática. Gravação em bloco: 3 comandos por bloco, não 3 por lead.
 */
export async function importSupervisorContacts(context: TenantContext, input: {
  importId: string;
  consent: boolean;
  contacts: Array<{ name: string; phone: string; email: string | null; note: string | null }>;
  /** Nome da lista (DEC-191). Vazio: "Lista DD/MM". Só vale no primeiro bloco; os outros reaproveitam a lista. */
  listName?: string | null;
  /** Contatos que a tela deixou de fora (sem celular, com problema). Só conta no primeiro bloco. */
  rejected?: number;
  /** Contatos que a tela já viu no CRM no "Conferir" e nem mandou. Só conta no primeiro bloco. */
  duplicatesBefore?: number;
  /** "Prazo para o primeiro contato" (25/11): horas sem virar pendência para o corretor. Padrão 24. */
  firstContactHours?: number | null;
}) {
  await assertSupervisor(context);
  if (!input.consent) throw new SupervisorImportError("Confirme que você tem autorização para contatar essas pessoas.");
  // O servidor relê cada contato: nunca confia no que a tela mandou.
  const seen = new Set<string>();
  const chunk = input.contacts.slice(0, SUPERVISOR_IMPORT_CHUNK);
  const clean = chunk.flatMap((draft) => {
    const contact = buildContact({ line: 0, name: titleCase(cleanName(draft.name)), phoneRaw: draft.phone, email: draft.email?.match(EMAIL)?.[0]?.toLowerCase() ?? null, note: draft.note });
    if (!contact.phone || contact.problem || seen.has(contact.phone)) return [];
    seen.add(contact.phone);
    return [contact];
  });
  if (!clean.length) throw new SupervisorImportError("Nenhum contato pronto para importar.");

  const room = await weekRoom(context);
  if (room <= 0) throw new SupervisorImportError(`Você já importou ${SUPERVISOR_IMPORT_WEEKLY_MAX.toLocaleString("pt-BR")} contatos nos últimos 7 dias. Dá para importar de novo quando a semana virar.`);

  const [known, listsReady] = await Promise.all([existingPhones(context.tenantId, clean.map((contact) => contact.phone!)), isLeadListsReady()]);
  const fresh = clean.filter((contact) => !known.has(contact.phone!.slice(-11))).slice(0, room);
  const duplicates = clean.length - fresh.length;
  const now = new Date();
  const rows = fresh.map((contact) => ({ contact, leadId: randomUUID() }));
  // Lista e leads na mesma transação: "Tentar de novo" não soma o bloco duas vezes.
  const list = await getDatabase().transaction(async (tx) => {
    // A lista (pasta) nasce no primeiro bloco, mesmo se todos forem repetidos: ela mostra quantos ficaram de fora.
    const saved = listsReady ? await saveListChunk(tx, context, {
      listId: input.importId,
      name: input.listName ?? null,
      imported: fresh.length,
      duplicates,
      rejected: chunk.length - clean.length,
      rejectedBefore: Math.max(0, Math.min(Math.floor(input.rejected ?? 0), SUPERVISOR_IMPORT_WEEKLY_MAX)),
      duplicatesBefore: Math.max(0, Math.min(Math.floor(input.duplicatesBefore ?? 0), SUPERVISOR_IMPORT_WEEKLY_MAX)),
    }) : null;
    if (rows.length) {
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
        sourceMetadata: { import: "supervisor_list", importId: input.importId, supervisorId: context.userId, firstContactHours: cleanFirstContactHours(input.firstContactHours) },
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
        metadata: { sent: input.contacts.length, imported: fresh.length, duplicates, leadIds: rows.map((row) => row.leadId), listId: saved?.id ?? null },
      });
      if (saved) await tx.update(leadListLinks).set({ importListId: saved.id }).where(and(eq(leadListLinks.tenantId, context.tenantId), inArray(leadListLinks.id, rows.map((row) => row.leadId))));
    }
    return saved;
  });
  return { imported: fresh.length, duplicates, listId: list?.id ?? null, listName: list?.name ?? null };
}

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

const ownLists = (context: TenantContext) => and(eq(schema.supervisorLeadLists.tenantId, context.tenantId), eq(schema.supervisorLeadLists.supervisorId, context.userId));

async function listNames(context: TenantContext, db: Tx | ReturnType<typeof getDatabase> = getDatabase()) {
  const rows = await db.select({ name: schema.supervisorLeadLists.name }).from(schema.supervisorLeadLists).where(ownLists(context));
  return rows.map((row) => row.name);
}

/** Nome sugerido para a próxima lista: "Lista 24/11", ou "Lista 24/11 (2)" se já houve uma hoje. Null antes da 0236. */
export async function suggestListName(context: TenantContext, now = new Date()) {
  if (!(await isLeadListsReady())) return null;
  return uniqueListName(defaultListName(now), await listNames(context));
}

/** Cria a lista no primeiro bloco ou soma os números nos seguintes. A lista é sempre do próprio supervisor. */
async function saveListChunk(db: Tx, context: TenantContext, input: { listId: string; name: string | null; imported: number; duplicates: number; rejected: number; rejectedBefore: number; duplicatesBefore: number }) {
  const [current] = await db.select({ id: schema.supervisorLeadLists.id, name: schema.supervisorLeadLists.name, tenantId: schema.supervisorLeadLists.tenantId, supervisorId: schema.supervisorLeadLists.supervisorId })
    .from(schema.supervisorLeadLists).where(eq(schema.supervisorLeadLists.id, input.listId)).limit(1);
  const now = new Date();
  if (current) {
    if (current.tenantId !== context.tenantId || current.supervisorId !== context.userId) throw new SupervisorImportError("Essa lista é de outra pessoa. Comece a importação de novo.");
    await db.update(schema.supervisorLeadLists).set({
      importedCount: sql`${schema.supervisorLeadLists.importedCount} + ${input.imported}`,
      duplicateCount: sql`${schema.supervisorLeadLists.duplicateCount} + ${input.duplicates}`,
      rejectedCount: sql`${schema.supervisorLeadLists.rejectedCount} + ${input.rejected}`,
      updatedAt: now,
    }).where(eq(schema.supervisorLeadLists.id, current.id));
    return { id: current.id, name: current.name };
  }
  const name = uniqueListName(cleanListName(input.name) || defaultListName(now), await listNames(context, db));
  await db.insert(schema.supervisorLeadLists).values({
    id: input.listId,
    tenantId: context.tenantId,
    branchId: context.branchId,
    supervisorId: context.userId,
    name,
    importedCount: input.imported,
    duplicateCount: input.duplicates + input.duplicatesBefore,
    rejectedCount: input.rejected + input.rejectedBefore,
  });
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: context.userId, entidade: "supervisor_lead_list", entidadeId: input.listId, acao: "supervisor_lead_list.created",
    metadata: { tenantId: context.tenantId, name },
  });
  return { id: input.listId, name };
}

export type SupervisorLeadList = {
  id: string;
  name: string;
  createdAt: string;
  importedBy: string | null;
  /** Números guardados na importação. */
  imported: number;
  duplicates: number;
  rejected: number;
  legacy: boolean;
  /** Leads da lista agora (sem apagados e arquivados), quantos esperam distribuição e quantos responderam. */
  total: number;
  pending: number;
  replied: number;
};

/**
 * As listas (pastas) do supervisor, das mais novas para as mais antigas, com quantos esperam distribuição e quantos
 * já responderam. Uma consulta para as listas e uma para os números. Vazio antes da migration 0236.
 */
export async function listSupervisorLeadLists(context: TenantContext): Promise<SupervisorLeadList[]> {
  if (context.role !== "supervisor" || !(await isLeadListsReady())) return [];
  const db = getDatabase();
  const replied = teamListClientReplied();
  const listColumn = sql<string>`${leadListLinks.importListId}`;
  const [lists, stats] = await Promise.all([
    db.select({
      id: schema.supervisorLeadLists.id,
      name: schema.supervisorLeadLists.name,
      createdAt: schema.supervisorLeadLists.createdAt,
      importedBy: schema.user.name,
      imported: schema.supervisorLeadLists.importedCount,
      duplicates: schema.supervisorLeadLists.duplicateCount,
      rejected: schema.supervisorLeadLists.rejectedCount,
      legacy: schema.supervisorLeadLists.legacy,
    }).from(schema.supervisorLeadLists)
      .leftJoin(schema.user, eq(schema.user.id, schema.supervisorLeadLists.supervisorId))
      .where(ownLists(context))
      .orderBy(desc(schema.supervisorLeadLists.createdAt))
      .limit(500),
    db.select({
      listId: listColumn,
      total: count(),
      pending: sql<number>`count(*) filter (where ${schema.leads.corretorId} is null)`,
      replied: sql<number>`count(*) filter (where ${replied})`,
    }).from(schema.leads)
      .where(and(ownImport(context), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), sql`${leadListLinks.importListId} is not null`))
      .groupBy(listColumn),
  ]);
  const byList = new Map(stats.map((row) => [row.listId, row]));
  return lists.map((list) => {
    const stat = byList.get(list.id);
    return { ...list, createdAt: list.createdAt.toISOString(), total: Number(stat?.total ?? 0), pending: Number(stat?.pending ?? 0), replied: Number(stat?.replied ?? 0) };
  });
}

/** Renomear a lista. Só o supervisor dono; nome repetido ganha (2). Auditado. */
export async function renameSupervisorLeadList(context: TenantContext, input: { listId: string; name: string }) {
  await assertSupervisor(context);
  if (!(await isLeadListsReady())) throw new SupervisorImportError("As listas separadas ainda não estão ligadas.");
  const wanted = cleanListName(input.name);
  if (!wanted) throw new SupervisorImportError("Dê um nome para a lista.");
  const db = getDatabase();
  const [current] = await db.select({ id: schema.supervisorLeadLists.id, name: schema.supervisorLeadLists.name })
    .from(schema.supervisorLeadLists).where(and(ownLists(context), eq(schema.supervisorLeadLists.id, input.listId))).limit(1);
  if (!current) throw new SupervisorImportError("Não achei essa lista. Atualize a página.");
  if (current.name === wanted) return { id: current.id, name: current.name };
  const name = uniqueListName(wanted, (await listNames(context)).filter((other) => other !== current.name));
  await db.transaction(async (tx) => {
    await tx.update(schema.supervisorLeadLists).set({ name, updatedAt: new Date() }).where(eq(schema.supervisorLeadLists.id, current.id));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "supervisor_lead_list", entidadeId: current.id, acao: "supervisor_lead_list.renamed",
      metadata: { tenantId: context.tenantId, from: current.name, to: name },
    });
  });
  return { id: current.id, name };
}

/**
 * Texto do aviso no CRM (sem WhatsApp, pedido do Vinicios em 16/11). Desde 25/11 é um resumo quieto, um por
 * entrega: fica no sino, sem push, sem som e sem pendência (a lista só pesa depois do prazo).
 */
export function teamListNotice(received: number, hours = 24) {
  const contacts = received === 1 ? "1 contato" : `${received.toLocaleString("pt-BR")} contatos`;
  return {
    title: "Lista interna da equipe",
    message: `Seu supervisor enviou ${contacts}. Eles estão em Leads e viram pendência só se ficarem ${firstContactHoursLabel(hours)} sem primeiro contato.`,
  };
}

/** Aviso único quando o prazo de um lote passa: "N contatos da lista esperam o primeiro contato". */
export function teamListDueNotice(count: number) {
  const contacts = count === 1 ? "1 contato da lista da equipe espera" : `${count.toLocaleString("pt-BR")} contatos da lista da equipe esperam`;
  return { title: "Lista da equipe", message: `${contacts} o seu primeiro contato. O prazo passou.` };
}

/**
 * Varredura do SLA (25/11): o lote da lista da equipe que passou do prazo sem primeiro contato gera UM aviso por
 * corretor e entrega (push uma vez, sem lead no aviso, para não abrir a oferta de lead novo nem tocar por lead).
 * A chave de idempotência impede repetir o aviso nas próximas varreduras.
 */
export async function notifyExpiredTeamListBatches(tenantId: string, now = new Date()) {
  const longest = 72 * 3_600_000;
  const rows = await getDatabase().select({
    brokerId: schema.leads.corretorId,
    assignedAt: schema.leads.assignedAt,
    firstContactHours: sql<string | null>`${schema.leads.sourceMetadata}->>'firstContactHours'`,
    contacted: sql<boolean>`(${schema.leads.firstContactAt} is not null or exists (
      select 1 from ${schema.whatsappMessages}
      where ${schema.whatsappMessages.tenantId} = ${schema.leads.tenantId} and ${schema.whatsappMessages.leadId} = ${schema.leads.id}
    ))`,
  }).from(schema.leads).where(and(
    eq(schema.leads.tenantId, tenantId),
    eq(schema.leads.sourceChannel, SUPERVISOR_IMPORT_SOURCE),
    eq(schema.leads.status, "in_contact"),
    isNull(schema.leads.deletedAt),
    isNull(schema.leads.archivedAt),
    sql`${schema.leads.corretorId} is not null`,
    // Só lotes que venceram há pouco (prazo mínimo 4 h, máximo 72 h, mais um dia de folga para a varredura).
    sql`${schema.leads.assignedAt} <= ${new Date(now.getTime() - 4 * 3_600_000).toISOString()}`,
    gte(schema.leads.assignedAt, new Date(now.getTime() - longest - 24 * 3_600_000)),
  )).limit(5000);
  const batches = groupExpiredImportBatches(rows.flatMap((row) => row.brokerId && row.assignedAt
    ? [{ brokerId: row.brokerId, assignedAt: row.assignedAt, hours: importedFirstContactHours({ firstContactHours: row.firstContactHours }), contacted: Boolean(row.contacted) }]
    : []), now);
  const sent = await Promise.allSettled(batches.map((batch) => {
    const notice = teamListDueNotice(batch.count);
    return publishNotification({
      capability: "team_list_distributed",
      tenantId,
      recipientUserId: batch.brokerId,
      type: "team_list_due",
      title: notice.title,
      message: notice.message,
      url: "/leads",
      tag: "corretop-leads",
      idempotencyKey: `team-list-due:${batch.brokerId}:${batch.assignedAt.getTime()}`,
    });
  }));
  return sent.filter((result) => result.status === "fulfilled" && result.value).length;
}

/** O prazo do aviso: o da lista distribuída (o menor, se o lote misturar listas). */
async function distributedFirstContactHours(context: TenantContext, only: ReturnType<typeof and>) {
  const [row] = await getDatabase().select({ hours: sql<string | null>`min((${schema.leads.sourceMetadata}->>'firstContactHours')::int)::text` })
    .from(schema.leads)
    .where(and(ownImport(context), only, gte(schema.leads.assignedAt, new Date(Date.now() - 60_000))));
  return importedFirstContactHours({ firstContactHours: row?.hours ?? null });
}

/**
 * Botão Distribuir: entrega os leads pendentes do supervisor para os corretores da equipe dele, na quantidade
 * escolhida (os mais antigos primeiro). Atribuição direta, sem mensagem para o cliente, sem WhatsApp ao corretor e
 * sem prazo de SLA (lista fria). Um UPDATE em bloco por corretor.
 */
export async function distributeSupervisorLeads(context: TenantContext, input: { counts: Record<string, number>; leadIds?: string[]; listId?: string | null }) {
  await assertSupervisor(context);
  const team = await listSupervisorTeamBrokers(context);
  const teamIds = new Set(team.map((broker) => broker.id));
  const wanted = Object.entries(input.counts).filter(([, total]) => total > 0);
  if (!wanted.length || wanted.some(([id]) => !teamIds.has(id))) throw new SupervisorImportError("Escolha corretores da sua equipe.");

  const db = getDatabase();
  // Selecionados na lista: só eles entram. Sem seleção: os mais antigos que esperam.
  // Dentro de uma lista (DEC-191): só os leads dela.
  const inList = input.listId && (await isLeadListsReady()) ? eq(leadListLinks.importListId, input.listId) : undefined;
  const only = and(input.leadIds?.length ? inArray(schema.leads.id, input.leadIds) : undefined, inList);
  const [pendingRow] = await db.select({ total: count() }).from(schema.leads).where(and(pendingWhere(context), only));
  const pendingTotal = Number(pendingRow?.total ?? 0);
  if (!pendingTotal) throw new SupervisorImportError("Esses leads já foram distribuídos. Atualize a página.");
  const { shares } = planShares(pendingTotal, wanted.map(([id]) => id), Object.fromEntries(wanted));
  const now = new Date();
  const received = new Map<string, number>();
  await db.transaction(async (tx) => {
    for (const share of shares) {
      const pick = tx.select({ id: schema.leads.id }).from(schema.leads).where(and(pendingWhere(context), only)).orderBy(asc(schema.leads.createdAt)).limit(share.count).for("update", { skipLocked: true });
      const updated = await tx.update(schema.leads).set({
        corretorId: share.brokerId,
        // Já aceito (16/11): a supervisão escolheu o corretor, então não há passo de aceitar. O lead entra
        // em atendimento com o telefone liberado; o primeiro contato fica para quando o corretor chamar.
        status: "in_contact",
        serviceStartedAt: now,
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
      metadata: { shares: Object.fromEntries(received), listId: input.listId ?? null },
    });
  });

  // Um resumo quieto por corretor (só o sino, sem push nem som), nunca pelo número oficial (25/11).
  const batch = randomUUID();
  const hours = await distributedFirstContactHours(context, only);
  await Promise.allSettled([...received].map(([brokerId, total]) => {
    const notice = teamListNotice(total, hours);
    return publishInAppNotification({
      capability: "team_list_distributed",
      tenantId: context.tenantId,
      recipientUserId: brokerId,
      type: "team_list_distributed",
      title: notice.title,
      message: notice.message,
      idempotencyKey: `team-list:${batch}:${brokerId}`,
    });
  }));

  const distributed = [...received.values()].reduce((sum, value) => sum + value, 0);
  return { distributed, left: pendingTotal - distributed, perBroker: Object.fromEntries(received) };
}
