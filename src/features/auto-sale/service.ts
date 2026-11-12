import "server-only";

import { randomUUID } from "node:crypto";

import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";

import { enqueueMetaTextMessage } from "@/features/communication-channels/outbound-service";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { assignLeadToBroker } from "@/features/lead-distribution/service";
import { recordStageChangeForLead } from "@/features/leads/stage-history";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { postgresErrorCode } from "@/shared/db/postgres-errors";

import { MANAGER_CALL_REASONS, OPEN_DEAL_STATUSES, type AutoSaleChannel, type AutoSaleMode, type DealFacts, type ManagerCallReason, type Promotion } from "./contracts";
import { autoSaleIneligibleReasons, ELIGIBLE_LEAD_STATUSES, IN_QUALIFICATION_STATUSES, type IneligibleReason } from "./eligibility";
import { factsFromQualification } from "./facts";
import { readAutoSaleFlags } from "./flag";
import { managerSummary } from "./manager-summary";
import { HOLD_MESSAGE, openingMessages } from "./quote-messages";
import { getDeal, getOpenDealForLead, listOffers, listTurns, type DealRow } from "./repository";
import { leadStatusForStage, shouldMoveLead } from "./state-machine";

type Db = ReturnType<typeof getDatabase>;

export class AutoSaleError extends Error {}

const PROVISIONAL_SOURCES = ["automatic_offer", "manual_offer"];
const DEAL_RUNTIME_DEFAULT = { networkSourced: false, guardBlocks: 0, pdfSent: 0 };
export type DealRuntime = typeof DEAL_RUNTIME_DEFAULT;

export function dealRuntime(deal: Pick<DealRow, "limits">): DealRuntime {
  return { ...DEAL_RUNTIME_DEFAULT, ...(deal.limits as Partial<DealRuntime>) };
}

export async function audit(userId: string, dealId: string, action: string, metadata: Record<string, unknown>) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId, entidade: "auto_sale_deal", entidadeId: dealId, acao: action, metadata });
}

export async function brokerageInfo(tenantId: string) {
  const db = getDatabase();
  const [tenant] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, tenantId)).limit(1);
  const branches = await db.select({ name: schema.branches.name }).from(schema.branches)
    .where(and(eq(schema.branches.tenantId, tenantId), eq(schema.branches.status, "active"))).limit(4);
  return { name: tenant?.name ?? "corretora", phone: null as string | null, units: branches.map((branch) => branch.name) };
}

export async function activePromotions(tenantId: string, today: string): Promise<Promotion[]> {
  try {
    const rows = await getDatabase().select().from(schema.autoSalePromotions).where(and(
      eq(schema.autoSalePromotions.tenantId, tenantId), eq(schema.autoSalePromotions.active, true),
      lte(schema.autoSalePromotions.startsOn, today), gte(schema.autoSalePromotions.endsOn, today),
    ));
    return rows.map((row) => ({ id: row.id, operator: row.operator, title: row.title, description: row.description, startsOn: row.startsOn, endsOn: row.endsOn }));
  } catch {
    return [];
  }
}

// ─── Elegíveis ───────────────────────────────────────────────────────────────

export type EligibleLead = { id: string; nome: string; telefone: string; status: string; qualificationStatus: string; createdAt: Date; reasons: IneligibleReason[] };

/** Leads da busca do gestor com o motivo de cada um não poder entrar (lista vazia = pode). */
export async function searchLeadsForAutoSale(context: TenantContext, input: { query: string; onlyHot: boolean }): Promise<EligibleLead[]> {
  const db = getDatabase();
  const query = input.query.trim().slice(0, 80);
  const digits = query.replace(/\D/g, "");
  const leads = await db.select({
    id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone, status: schema.leads.status,
    qualificationStatus: schema.leads.qualificationStatus, consentimentoLgpd: schema.leads.consentimentoLgpd,
    corretorId: schema.leads.corretorId, assignmentSource: schema.leads.assignmentSource, deletedAt: schema.leads.deletedAt,
    archivedAt: schema.leads.archivedAt, createdAt: schema.leads.createdAt, branchId: schema.leads.branchId,
  }).from(schema.leads).where(and(
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt),
    inArray(schema.leads.status, [...ELIGIBLE_LEAD_STATUSES]),
    input.onlyHot ? inArray(schema.leads.qualificationStatus, ["hot", ...IN_QUALIFICATION_STATUSES]) : undefined,
    context.branchId && context.role !== "director" ? eq(schema.leads.branchId, context.branchId) : undefined,
    query ? or(ilike(schema.leads.nome, `%${query.replace(/[%_]/g, "")}%`), digits.length >= 4 ? ilike(schema.leads.telefone, `%${digits}%`) : undefined) : undefined,
  )).orderBy(desc(schema.leads.createdAt)).limit(30);
  if (!leads.length) return [];
  return Promise.all(leads.map(async (lead) => ({
    id: lead.id, nome: lead.nome, telefone: lead.telefone, status: lead.status, qualificationStatus: lead.qualificationStatus, createdAt: lead.createdAt,
    reasons: autoSaleIneligibleReasons(await eligibilityFacts(db, context.tenantId, lead)),
  })));
}

/**
 * Base legal (revisão do plano, DEC-182): consentimento registrado OU o cliente iniciou o contato
 * pelo WhatsApp (procedimento preliminar a contrato a pedido do titular, LGPD art. 7º, V).
 * Lead em oferta pendente (dono provisório, ninguém aceitou) conta como sem corretor.
 */
async function eligibilityFacts(db: Db | Parameters<Parameters<Db["transaction"]>[0]>[0], tenantId: string, lead: { id: string; telefone: string; status: string; qualificationStatus: string; consentimentoLgpd: boolean; corretorId: string | null; assignmentSource: string | null; deletedAt: Date | null; archivedAt: Date | null }) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [inbound, conversation, blocked, postSale, openDeal, accepted] = await Promise.all([
    db.select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages).where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, lead.id), inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]))).limit(1),
    db.select({ optOutAt: schema.aiConversations.optOutAt }).from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, tenantId), eq(schema.aiConversations.leadId, lead.id), isNotNull(schema.aiConversations.optOutAt))).limit(1),
    db.select({ id: schema.whatsappOutboundMessages.id }).from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, tenantId), eq(schema.whatsappOutboundMessages.recipientId, lead.id), eq(schema.whatsappOutboundMessages.providerErrorCode, "131049"), gte(schema.whatsappOutboundMessages.createdAt, since))).limit(1),
    db.select({ id: schema.postSaleOptOuts.id }).from(schema.postSaleOptOuts).where(and(eq(schema.postSaleOptOuts.tenantId, tenantId), eq(schema.postSaleOptOuts.leadId, lead.id))).limit(1),
    db.select({ id: schema.autoSaleDeals.id }).from(schema.autoSaleDeals).where(and(eq(schema.autoSaleDeals.tenantId, tenantId), eq(schema.autoSaleDeals.leadId, lead.id), inArray(schema.autoSaleDeals.status, [...OPEN_DEAL_STATUSES]))).limit(1).catch(() => []),
    db.select({ id: schema.leadOffers.id }).from(schema.leadOffers).where(and(eq(schema.leadOffers.tenantId, tenantId), eq(schema.leadOffers.leadId, lead.id), eq(schema.leadOffers.status, "ACCEPTED"))).limit(1),
  ]);
  const provisional = Boolean(lead.corretorId) && PROVISIONAL_SOURCES.includes(lead.assignmentSource ?? "") && !accepted.length;
  return {
    qualificationStatus: lead.qualificationStatus, status: lead.status, telefone: lead.telefone,
    consentimentoLgpd: lead.consentimentoLgpd || inbound.length > 0,
    corretorId: provisional ? null : lead.corretorId,
    deletedAt: lead.deletedAt, archivedAt: lead.archivedAt, optOutAt: conversation[0]?.optOutAt ?? null,
    metaBlockedRecently: blocked.length > 0, postSaleOptOut: postSale.length > 0, openDeal: openDeal.length > 0,
  };
}

// ─── Escolher o lead ─────────────────────────────────────────────────────────

export function assertManager(context: TenantContext) {
  if (context.role !== "director" && context.role !== "manager") throw new AutoSaleError("Só o diretor ou o gestor escolhe a negociação.");
  if (context.viewAs) throw new AutoSaleError("A visualização de outro usuário é somente leitura.");
}

async function assertWahaNumber(db: Db, tenantId: string, wahaNumberId: string, lead: { id: string }) {
  const [number] = await db.select({ id: schema.wahaNumbers.id, status: schema.wahaNumbers.status, scope: schema.wahaNumbers.scope, pausedUntil: schema.wahaNumbers.pausedUntil })
    .from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.id, wahaNumberId), eq(schema.wahaNumbers.tenantId, tenantId))).limit(1);
  if (!number || !["active", "ready"].includes(number.status) || !["tenant", "branch"].includes(number.scope)) throw new AutoSaleError("O número WAHA escolhido não está conectado.");
  // Anti-ban (revisão do plano): só o número que o cliente já usou para escrever; nunca mensagem fria.
  const [inbound] = await db.select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages)
    .where(and(eq(schema.whatsappMessages.tenantId, tenantId), eq(schema.whatsappMessages.leadId, lead.id), eq(schema.whatsappMessages.wahaNumberId, wahaNumberId), inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]))).limit(1);
  if (!inbound) throw new AutoSaleError("Pelo WAHA, só o número em que o cliente já escreveu. Use a Meta oficial.");
}

/**
 * Escolha do gestor (§1): numa transação com o lead travado, confere de novo a elegibilidade, cancela
 * ofertas pendentes a corretores, tira o lead da distribuição, pausa a IA de qualificação e cria a
 * negociação. O índice único garante uma negociação aberta por empresa.
 */
export async function startDeal(context: TenantContext, input: { leadId: string; channel: AutoSaleChannel; wahaNumberId: string | null; mode: AutoSaleMode }) {
  assertManager(context);
  const flags = await readAutoSaleFlags(context.tenantId);
  if (!flags.enabled || !flags.global) throw new AutoSaleError("A Venda Automatizada está desligada para esta empresa.");
  if (input.mode === "autopilot" && !flags.autopilot) throw new AutoSaleError("O Autopiloto ainda não foi liberado.");
  const db = getDatabase();
  if (input.channel === "waha") {
    if (!input.wahaNumberId) throw new AutoSaleError("Escolha o número WAHA.");
    await assertWahaNumber(db, context.tenantId, input.wahaNumberId, { id: input.leadId });
  }
  const now = new Date();
  const dealId = randomUUID();
  let facts: DealFacts = {};
  try {
    await db.transaction(async (tx) => {
      const [lead] = await tx.select().from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, context.tenantId))).for("update").limit(1);
      if (!lead) throw new AutoSaleError("Lead não encontrado.");
      if (context.role === "manager" && context.branchId && lead.branchId !== context.branchId) throw new AutoSaleError("Lead de outra unidade.");
      const reasons = autoSaleIneligibleReasons(await eligibilityFacts(tx, context.tenantId, lead));
      if (reasons.length) throw new AutoSaleError("Este lead não pode entrar no piloto agora. Atualize a lista.");
      const [conversation] = await tx.select({ id: schema.aiConversations.id, automationState: schema.aiConversations.automationState, status: schema.aiConversations.status })
        .from(schema.aiConversations).where(and(eq(schema.aiConversations.tenantId, context.tenantId), eq(schema.aiConversations.leadId, lead.id)))
        .orderBy(desc(schema.aiConversations.startedAt)).limit(1);
      const [session] = await tx.select({ collectedData: schema.aiQualificationSessions.collectedData }).from(schema.aiQualificationSessions)
        .where(and(eq(schema.aiQualificationSessions.tenantId, context.tenantId), eq(schema.aiQualificationSessions.leadId, lead.id))).limit(1);
      facts = factsFromQualification({ nome: lead.nome, tipo: lead.tipo, livesCount: lead.livesCount, collectedData: session?.collectedData, qualificationDetails: lead.qualificationDetails, formData: lead.formData });

      // Oferta pendente a corretor: cancela e solta o dono provisório (ninguém tinha aceitado).
      await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
        eq(schema.leadOffers.tenantId, context.tenantId), eq(schema.leadOffers.leadId, lead.id), inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
      ));
      await tx.update(schema.leads).set({
        ...(lead.corretorId ? { corretorId: null, assignmentSource: null, assignmentStrategy: null, assignedAt: null } : {}),
        distributionStatus: "removed", distributionRemovedAt: now, distributionRemovalReason: "auto_sale",
        distributionRemovalNote: "Na Venda Automatizada", distributionRemovedBy: context.userId, distributionUpdatedAt: now, updatedAt: now,
      }).where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
      // A venda assume a conversa (inclusive no meio da qualificação): o que a qualificação ainda tinha na fila
      // para o cliente não sai mais. Avisos para a equipe não são tocados.
      await tx.update(schema.whatsappOutboundMessages).set({ status: "cancelled", updatedAt: now }).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId), eq(schema.whatsappOutboundMessages.recipientType, "lead"),
        eq(schema.whatsappOutboundMessages.recipientId, lead.id), inArray(schema.whatsappOutboundMessages.status, ["pending", "queued"]),
        sql`${schema.whatsappOutboundMessages.purpose} <> 'autoSale'`,
      ));
      if (conversation) {
        await tx.update(schema.aiConversations).set({ automationState: "PAUSED", pausedByUserId: context.userId, updatedAt: now })
          .where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, context.tenantId)));
      }
      await tx.insert(schema.autoSaleDeals).values({
        id: dealId, tenantId: context.tenantId, leadId: lead.id, stage: "chosen", status: "active", mode: input.mode,
        channel: input.channel, wahaNumberId: input.channel === "waha" ? input.wahaNumberId : null, chosenBy: context.userId,
        facts, limits: DEAL_RUNTIME_DEFAULT, aiConversationPaused: Boolean(conversation),
        restoreState: {
          distributionStatus: lead.distributionStatus, provisionalBrokerId: lead.corretorId,
          conversationId: conversation?.id ?? null, automationState: conversation?.automationState ?? null,
        },
        createdAt: now, updatedAt: now,
      });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "auto_sale_deal", entidadeId: dealId, acao: "auto_sale.started", metadata: { leadId: lead.id, mode: input.mode, channel: input.channel, provisionalBrokerReleased: Boolean(lead.corretorId) } });
    });
  } catch (error) {
    if (postgresErrorCode(error) === "23505") throw new AutoSaleError("Já existe uma negociação aberta nesta empresa. Encerre a atual antes de escolher outro lead.");
    throw error;
  }
  // Abertura determinística: assistente virtual da corretora, confirmando o que já sabe.
  const brokerage = await brokerageInfo(context.tenantId);
  const deal = (await getDeal(context.tenantId, dealId))!;
  const turnId = await recordTurn(deal, { direction: "out", kind: "opening", body: null, decision: { action: "confirm" } });
  await queueOutgoing(deal, openingMessages({ brokerageName: brokerage.name, facts }).map((body) => ({ kind: "text" as const, body })), turnId);
  await db.update(schema.autoSaleDeals).set({ stage: "confirming", updatedAt: new Date() }).where(eq(schema.autoSaleDeals.id, dealId));
  return { dealId };
}

/**
 * "Pegar o próximo quente" (pedido do Vinicios, 12/11): um clique escolhe o lead quente mais recente que
 * ainda pode entrar (nenhum corretor aceitou; oferta pendente é cancelada na escolha) e já inicia a
 * negociação pela Meta oficial. Mesmas travas da escolha manual (`startDeal` confere tudo de novo).
 */
export async function startNextHotDeal(context: TenantContext, input: { mode: AutoSaleMode }) {
  assertManager(context);
  const candidates = await searchLeadsForAutoSale(context, { query: "", onlyHot: true });
  // Só quente aqui: lead em qualificação entra pela escolha manual, não pelo "próximo quente".
  const next = candidates.find((lead) => lead.qualificationStatus === "hot" && lead.reasons.length === 0);
  if (!next) throw new AutoSaleError("Nenhum lead quente disponível agora: todos já têm corretor, estão sem base legal ou já estão numa negociação.");
  const { dealId } = await startDeal(context, { leadId: next.id, channel: "meta", wahaNumberId: null, mode: input.mode });
  await audit(context.userId, dealId, "auto_sale.next_hot_picked", { leadId: next.id, mode: input.mode });
  return { dealId, leadName: next.nome };
}

// ─── Turnos e outbox ─────────────────────────────────────────────────────────

export async function recordTurn(deal: Pick<DealRow, "id" | "tenantId">, input: { direction: "in" | "out" | "system"; kind: string; body: string | null; providerMessageId?: string | null; intent?: string | null; objection?: string | null; facts?: unknown; decision?: unknown; guard?: unknown; model?: string | null; processedAt?: Date | null }) {
  const id = randomUUID();
  const inserted = await getDatabase().insert(schema.autoSaleTurns).values({
    id, tenantId: deal.tenantId, dealId: deal.id, direction: input.direction, kind: input.kind, body: input.body,
    providerMessageId: input.providerMessageId ?? null, intent: input.intent ?? null, objection: input.objection ?? null,
    facts: input.facts ?? null, decision: input.decision ?? null, guard: input.guard ?? null, model: input.model ?? null,
    processedAt: input.processedAt ?? (input.direction === "in" ? null : new Date()),
  }).onConflictDoNothing().returning({ id: schema.autoSaleTurns.id });
  return inserted[0]?.id ?? null;
}

export type OutgoingItem = { kind: "text" | "document" | "image"; body: string | null; mediaKey?: string; mediaFilename?: string; mediaMime?: string; offerId?: string };

/** Status inicial pelo modo (§12): Simulação nada sai; Copiloto espera aprovação; Autopiloto segue. */
export function initialOutboxStatus(mode: AutoSaleMode) {
  return mode === "simulation" ? "simulated" as const : mode === "copilot" ? "draft" as const : "approved" as const;
}

export async function queueOutgoing(deal: Pick<DealRow, "id" | "tenantId" | "mode" | "channel">, items: readonly OutgoingItem[], turnId: string | null) {
  if (!items.length) return [];
  const now = new Date();
  const status = initialOutboxStatus(deal.mode);
  const rows = items.map((item, index) => ({
    id: randomUUID(), tenantId: deal.tenantId, dealId: deal.id, kind: item.kind, body: item.body,
    mediaKey: item.mediaKey ?? null, mediaFilename: item.mediaFilename ?? null, mediaMime: item.mediaMime ?? null, offerId: item.offerId ?? null,
    status, channel: deal.channel, idempotencyKey: `auto-sale:${deal.id}:${turnId ?? randomUUID()}:${index}`,
    // Autopiloto: espaça as mensagens como chat (3 s entre uma e outra).
    scheduledAt: new Date(now.getTime() + index * 3_000), approvedAt: status === "approved" ? now : null,
    createdAt: new Date(now.getTime() + index), updatedAt: now,
  }));
  await getDatabase().insert(schema.autoSaleOutbox).values(rows).onConflictDoNothing();
  return rows.map((row) => row.id);
}

/** Cancela tudo que ainda não saiu (opt-out, assumir, encerrar). */
export async function cancelPendingOutgoing(tenantId: string, dealId: string, leadId: string, reason: string) {
  const db = getDatabase();
  const now = new Date();
  await db.update(schema.autoSaleOutbox).set({ status: "cancelled", holdReason: reason, updatedAt: now }).where(and(
    eq(schema.autoSaleOutbox.tenantId, tenantId), eq(schema.autoSaleOutbox.dealId, dealId), inArray(schema.autoSaleOutbox.status, ["draft", "approved", "held"]),
  ));
  await db.update(schema.whatsappOutboundMessages).set({ status: "cancelled", updatedAt: now }).where(and(
    eq(schema.whatsappOutboundMessages.tenantId, tenantId), eq(schema.whatsappOutboundMessages.recipientId, leadId), eq(schema.whatsappOutboundMessages.purpose, "autoSale"),
    inArray(schema.whatsappOutboundMessages.status, ["pending", "queued"]),
  ));
}

// ─── Etapa do lead ───────────────────────────────────────────────────────────

/** O agente move o lead só para frente (§3), com `actorType: "ai"` no histórico. */
export async function moveLeadForStage(deal: Pick<DealRow, "tenantId" | "leadId">, stage: DealRow["stage"]) {
  const target = leadStatusForStage(stage);
  const db = getDatabase();
  const [lead] = await db.select({ status: schema.leads.status, stageEnteredAt: schema.leads.stageEnteredAt }).from(schema.leads)
    .where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, deal.tenantId))).limit(1);
  if (!lead || !shouldMoveLead(lead.status, target)) return;
  const now = new Date();
  await db.transaction(async (tx) => {
    const updated = await tx.update(schema.leads).set({ status: target as typeof lead.status, stageEnteredAt: now, updatedAt: now, version: sql`${schema.leads.version} + 1` })
      .where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, deal.tenantId), eq(schema.leads.status, lead.status))).returning({ id: schema.leads.id });
    if (!updated.length) return;
    await recordStageChangeForLead(tx, { tenantId: deal.tenantId, leadId: deal.leadId, fromStatus: lead.status, toStatus: target!, changedAt: now, actorType: "ai", actorUserId: null, reason: "Venda Automatizada", previousStageEnteredAt: lead.stageEnteredAt });
  });
}

// ─── Gestor ──────────────────────────────────────────────────────────────────

/**
 * Chama o gestor que escolheu a negociação (§11): só ele recebe aviso. O agente segura a conversa
 * e não avisa nenhum corretor.
 */
export async function callManager(deal: DealRow, reason: ManagerCallReason) {
  const db = getDatabase();
  const now = new Date();
  await db.update(schema.autoSaleDeals).set({ status: "waiting_manager", stage: "manager_called", managerCallReason: reason, managerCalledAt: now, replyDueAt: null, nextFollowUpAt: null, updatedAt: now })
    .where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, deal.tenantId)));
  const [lead] = await db.select({ nome: schema.leads.nome }).from(schema.leads).where(eq(schema.leads.id, deal.leadId)).limit(1);
  const offers = await listOffers(deal.tenantId, deal.id).catch(() => []);
  const turns = await listTurns(deal.tenantId, deal.id, 30).catch(() => []);
  const summary = managerSummary({ customerName: lead?.nome ?? "Cliente", facts: deal.facts as DealFacts, offers: offers.map((offer) => offer.snapshot), objections: turns.map((turn) => turn.objection).filter((value): value is string => Boolean(value)), reason });
  await db.insert(schema.notifications).values({
    id: randomUUID(), tenantId: deal.tenantId, recipientUserId: deal.chosenBy, leadId: deal.leadId, type: "auto_sale_manager_called",
    title: `Venda Automatizada: ${MANAGER_CALL_REASONS[reason]}`, message: summary.slice(0, 900),
    idempotencyKey: `auto-sale:${deal.id}:call:${now.getTime()}`,
  }).onConflictDoNothing();
  // WhatsApp ao gestor, quando ele tem telefone de perfil; falha não trava a negociação.
  const [profile] = await db.select({ phone: schema.brokerProfiles.phone }).from(schema.brokerProfiles)
    .where(and(eq(schema.brokerProfiles.tenantId, deal.tenantId), eq(schema.brokerProfiles.userId, deal.chosenBy))).limit(1);
  if (profile?.phone) {
    await enqueueMetaTextMessage({
      tenantId: deal.tenantId, recipientType: "user", recipientId: deal.chosenBy, destinationPhone: profile.phone,
      body: `Venda Automatizada: ${MANAGER_CALL_REASONS[reason]} (${lead?.nome ?? "cliente"}). Abra a negociação no CorreTop para decidir.`,
      idempotencyKey: `auto-sale:${deal.id}:manager:${now.getTime()}`, purpose: "autoSaleManager",
    }).catch((error) => console.warn("[auto-sale] manager_whatsapp_failed", { dealId: deal.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" }));
  }
  await recordTurn(deal, { direction: "system", kind: "manager_called", body: MANAGER_CALL_REASONS[reason], decision: { reason } });
}

async function loadDealForManager(context: TenantContext, dealId: string) {
  assertManager(context);
  const deal = await getDeal(context.tenantId, dealId);
  if (!deal) throw new AutoSaleError("Negociação não encontrada.");
  if (context.role === "manager" && deal.chosenBy !== context.userId) throw new AutoSaleError("Só quem escolheu a negociação decide por ela.");
  return deal;
}

export async function setDealPaused(context: TenantContext, dealId: string, paused: boolean) {
  const deal = await loadDealForManager(context, dealId);
  if (!["active", "paused", "waiting_manager"].includes(deal.status)) throw new AutoSaleError("A negociação já foi encerrada.");
  const db = getDatabase();
  const now = new Date();
  let reopened = 0;
  if (!paused) {
    // Devolver ao agente (12/11): as mensagens do cliente ainda sem resposta enviada voltam para a fila do turno,
    // e o "Vou confirmar isso e já te retorno." que ficou pendente sai da fila (a resposta de verdade vem agora).
    const since = deal.lastAgentMessageAt ?? deal.createdAt;
    const turns = await db.update(schema.autoSaleTurns).set({ processedAt: null })
      .where(and(eq(schema.autoSaleTurns.dealId, deal.id), eq(schema.autoSaleTurns.tenantId, context.tenantId), eq(schema.autoSaleTurns.direction, "in"), gte(schema.autoSaleTurns.createdAt, since)))
      .returning({ id: schema.autoSaleTurns.id });
    reopened = turns.length;
    await db.update(schema.autoSaleOutbox).set({ status: "cancelled", holdReason: "Gestor devolveu ao agente", updatedAt: now })
      .where(and(eq(schema.autoSaleOutbox.dealId, deal.id), eq(schema.autoSaleOutbox.tenantId, context.tenantId), inArray(schema.autoSaleOutbox.status, ["draft", "held"]), eq(schema.autoSaleOutbox.body, HOLD_MESSAGE)));
  }
  await db.update(schema.autoSaleDeals).set({
    status: paused ? "paused" : "active",
    replyDueAt: paused ? null : reopened ? now : deal.replyDueAt,
    managerCallReason: paused ? deal.managerCallReason : null,
    misunderstoodCount: paused ? deal.misunderstoodCount : 0,
    stage: !paused && deal.stage === "manager_called" ? (deal.firstQuoteAt ? "objections" : "confirming") : deal.stage,
    updatedAt: now,
  }).where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, context.tenantId)));
  await audit(context.userId, deal.id, paused ? "auto_sale.paused" : "auto_sale.resumed", { leadId: deal.leadId, reopenedTurns: reopened });
}

export async function setDealMode(context: TenantContext, dealId: string, mode: AutoSaleMode) {
  const deal = await loadDealForManager(context, dealId);
  if (mode === "autopilot" && !(await readAutoSaleFlags(context.tenantId)).autopilot) throw new AutoSaleError("O Autopiloto ainda não foi liberado.");
  const db = getDatabase();
  const now = new Date();
  await db.update(schema.autoSaleDeals).set({ mode, updatedAt: now }).where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, context.tenantId)));
  // Autopiloto não espera você (12/11): o que estava em "Para aprovar" passa a sair, como aprovado por quem trocou o modo.
  const approved = mode === "autopilot"
    ? await db.update(schema.autoSaleOutbox).set({ status: "approved", approvedBy: context.userId, approvedAt: now, scheduledAt: now, updatedAt: now })
      .where(and(eq(schema.autoSaleOutbox.dealId, deal.id), eq(schema.autoSaleOutbox.tenantId, context.tenantId), eq(schema.autoSaleOutbox.status, "draft"))).returning({ id: schema.autoSaleOutbox.id })
    : [];
  await audit(context.userId, deal.id, "auto_sale.mode_changed", { from: deal.mode, to: mode, approvedDrafts: approved.length });
}

type RestoreState = { distributionStatus?: string | null; conversationId?: string | null; automationState?: string | null };

/** Fecha a negociação e devolve o lead conforme a escolha do gestor (revisão do plano: nada fica preso). */
async function closeDeal(deal: DealRow, input: { status: "handed_off" | "won" | "lost" | "cancelled"; stage: DealRow["stage"]; reason: string; userId: string; returnToDistribution: boolean; restoreConversation: boolean }) {
  const db = getDatabase();
  const now = new Date();
  await cancelPendingOutgoing(deal.tenantId, deal.id, deal.leadId, input.reason);
  await db.update(schema.autoSaleDeals).set({ status: input.status, stage: input.stage, endedReason: input.reason, endedAt: now, replyDueAt: null, nextFollowUpAt: null, updatedAt: now })
    .where(and(eq(schema.autoSaleDeals.id, deal.id), eq(schema.autoSaleDeals.tenantId, deal.tenantId)));
  const restore = deal.restoreState as RestoreState;
  if (input.restoreConversation && restore.conversationId && restore.automationState) {
    await db.update(schema.aiConversations).set({ automationState: restore.automationState, pausedByUserId: null, updatedAt: now })
      .where(and(eq(schema.aiConversations.id, restore.conversationId), eq(schema.aiConversations.tenantId, deal.tenantId), eq(schema.aiConversations.automationState, "PAUSED")));
  }
  if (input.returnToDistribution) {
    const updated = await db.update(schema.leads).set({ distributionStatus: "unassigned", distributionRemovedAt: null, distributionRemovalReason: null, distributionRemovalNote: null, distributionRemovedBy: null, distributionUpdatedAt: now, updatedAt: now })
      .where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, deal.tenantId), isNull(schema.leads.corretorId), eq(schema.leads.distributionRemovalReason, "auto_sale"))).returning({ id: schema.leads.id });
    if (updated.length) await enqueueLeadDistributionJob({ tenantId: deal.tenantId, leadId: deal.leadId });
  }
  await audit(input.userId, deal.id, `auto_sale.${input.status}`, { leadId: deal.leadId, reason: input.reason, returnToDistribution: input.returnToDistribution });
}

/** "Assumir": o agente para na hora; o lead fica com o gestor (fora da distribuição), que conversa pela tela de Conversas. */
export async function takeOverDeal(context: TenantContext, dealId: string) {
  const deal = await loadDealForManager(context, dealId);
  await closeDeal(deal, { status: "handed_off", stage: "handed_off", reason: "manager_took_over", userId: context.userId, returnToDistribution: false, restoreConversation: false });
  await getDatabase().update(schema.autoSaleDeals).set({ handedToUserId: context.userId, handedAt: new Date() }).where(eq(schema.autoSaleDeals.id, deal.id));
}

/** Encerrar pelo gestor: devolve à distribuição (padrão) ou marca perdido (a etapa do lead fica com a pessoa). */
export async function endDeal(context: TenantContext, dealId: string, outcome: "return_to_distribution" | "lost") {
  const deal = await loadDealForManager(context, dealId);
  await closeDeal(deal, { status: outcome === "lost" ? "lost" : "cancelled", stage: outcome === "lost" ? "lost" : deal.stage, reason: outcome, userId: context.userId, returnToDistribution: outcome === "return_to_distribution", restoreConversation: outcome === "return_to_distribution" });
}

/** Encerramento automático (opt-out ou gestor sem ação além do prazo). Opt-out nunca volta à régua. */
export async function endDealBySystem(deal: DealRow, reason: "opt_out" | "manager_idle" | "assigned_elsewhere") {
  const db = getDatabase();
  if (reason === "assigned_elsewhere") {
    // Alguém atribuiu o lead por fora (atribuição manual): o agente para e não mexe no novo dono.
    await closeDeal(deal, { status: "handed_off", stage: "handed_off", reason, userId: deal.chosenBy, returnToDistribution: false, restoreConversation: false });
    return;
  }
  if (reason === "opt_out") {
    const restore = deal.restoreState as RestoreState;
    if (restore.conversationId) {
      await db.update(schema.aiConversations).set({ optOutAt: new Date(), updatedAt: new Date() })
        .where(and(eq(schema.aiConversations.id, restore.conversationId), eq(schema.aiConversations.tenantId, deal.tenantId)));
    }
    // Os links públicos da cotação deixam de abrir (LGPD: o cliente pediu para parar).
    await db.update(schema.autoSaleOffers).set({ publicRevokedAt: new Date() })
      .where(and(eq(schema.autoSaleOffers.dealId, deal.id), eq(schema.autoSaleOffers.tenantId, deal.tenantId), isNull(schema.autoSaleOffers.publicRevokedAt)));
    await db.update(schema.leads).set({ distributionRemovalNote: "Pediu para não receber mensagens (Venda Automatizada)", updatedAt: new Date() })
      .where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, deal.tenantId)));
  }
  await closeDeal(deal, { status: "cancelled", stage: reason === "opt_out" ? "lost" : deal.stage, reason, userId: deal.chosenBy, returnToDistribution: reason === "manager_idle", restoreConversation: reason === "manager_idle" });
}

/**
 * Entregar a um corretor escolhido pelo gestor: a ÚNICA forma de a Venda Automatizada mudar o dono do
 * lead (§11). Usa a atribuição manual do CRM (histórico, eventos, aviso ao corretor) e mantém a etapa.
 */
export async function handOffToBroker(context: TenantContext, dealId: string, brokerId: string) {
  const deal = await loadDealForManager(context, dealId);
  if (!["active", "paused", "waiting_manager"].includes(deal.status)) throw new AutoSaleError("A negociação já foi encerrada.");
  const db = getDatabase();
  const [lead] = await db.select({ status: schema.leads.status, stageEnteredAt: schema.leads.stageEnteredAt }).from(schema.leads).where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  const [broker] = await db.select({ branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"))).limit(1);
  if (!lead || !broker?.branchId) throw new AutoSaleError("Corretor indisponível nesta empresa.");
  if (context.role === "manager" && context.branchId && broker.branchId !== context.branchId) throw new AutoSaleError("Corretor de outra unidade.");
  const result = await assignLeadToBroker(context, deal.leadId, brokerId, context.role === "director" ? "manual_director" : "manual_manager", "Entrega da Venda Automatizada", null, broker.branchId, { requireUnassigned: true, manualTransferOverride: true });
  if (result.status !== "assigned") throw new AutoSaleError(result.status === "conflict" ? result.reason : "Não foi possível entregar o lead.");
  // A atribuição volta a etapa para "Distribuído"; a negociação já estava adiante: devolve a etapa.
  const now = new Date();
  if (lead.status !== "distributed" && lead.status !== "new") {
    await db.transaction(async (tx) => {
      const updated = await tx.update(schema.leads).set({ status: lead.status, stageEnteredAt: lead.stageEnteredAt, updatedAt: now })
        .where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.status, "distributed"))).returning({ id: schema.leads.id });
      if (updated.length) await recordStageChangeForLead(tx, { tenantId: context.tenantId, leadId: deal.leadId, fromStatus: "distributed", toStatus: lead.status, changedAt: now, actorType: context.role === "director" ? "director" : "manager", actorUserId: context.userId, reason: "Entrega da Venda Automatizada mantém a etapa" });
    });
  }
  await closeDeal(deal, { status: "handed_off", stage: "handed_off", reason: "handed_to_broker", userId: context.userId, returnToDistribution: false, restoreConversation: false });
  await db.update(schema.autoSaleDeals).set({ handedToUserId: brokerId, handedAt: now }).where(eq(schema.autoSaleDeals.id, deal.id));
  await audit(context.userId, deal.id, "auto_sale.handed_off", { leadId: deal.leadId, brokerId });
}

/** Corretores ativos para a busca da entrega (só o gestor vê; o agente nunca usa). */
export async function listBrokersForHandOff(context: TenantContext, query: string) {
  assertManager(context);
  const text = query.trim().slice(0, 60).replace(/[%_]/g, "");
  return getDatabase().select({ id: schema.user.id, name: schema.user.name, branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships).innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true),
      context.role === "manager" && context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : undefined,
      text ? ilike(schema.user.name, `%${text}%`) : undefined,
    )).orderBy(schema.user.name).limit(20);
}

export { getOpenDealForLead };
