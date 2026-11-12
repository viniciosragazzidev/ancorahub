import "server-only";

import { and, count, desc, eq, gte, inArray, sql, sum } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { isUndefinedTableError } from "@/shared/db/postgres-errors";

import { MANAGER_CALL_REASONS, OPEN_DEAL_STATUSES, type AutoSaleChannel, type AutoSaleMode, type AutoSaleStage, type AutoSaleStatus, type ManagerCallReason } from "./contracts";
import { readAutoSaleFlags } from "./flag";
import { readAutoSaleWatch } from "./watch";
import { dealMetrics } from "./metrics";
import { getDeal, listOffers, listOutbox, listTurns } from "./repository";

export type DealListRow = {
  id: string; leadId: string; leadName: string; stage: AutoSaleStage; status: AutoSaleStatus; mode: AutoSaleMode; channel: AutoSaleChannel;
  managerCallReason: string | null; pendingApprovals: number; updatedAt: string; createdAt: string; costUsd: number;
};

export type AutoSaleOverview =
  | { state: "migration_pending" }
  | { state: "ready"; deals: DealListRow[]; openDealId: string | null; autopilotAllowed: boolean; globalEnabled: boolean; catalogReady: boolean; watchingSince: string | null; robot: { health: "ok" | "atrasado" | "desconhecido"; lastRunAt: string | null }; summary: { total: number; documentsRequested: number; managerCalls: number } };

async function aiCostByLead(tenantId: string, leadIds: string[], since: Date) {
  if (!leadIds.length) return new Map<string, number>();
  const rows = await getDatabase().select({ leadId: schema.aiAttendanceLogs.leadId, total: sum(schema.aiAttendanceLogs.estimatedCost) }).from(schema.aiAttendanceLogs)
    .where(and(eq(schema.aiAttendanceLogs.tenantId, tenantId), inArray(schema.aiAttendanceLogs.leadId, leadIds), inArray(schema.aiAttendanceLogs.provider, ["auto_sale_turn", "auto_sale_audio"]), gte(schema.aiAttendanceLogs.createdAt, since)))
    .groupBy(schema.aiAttendanceLogs.leadId).catch(() => []);
  return new Map(rows.map((row) => [row.leadId ?? "", Number(row.total ?? 0)]));
}

export async function getAutoSaleOverview(context: TenantContext): Promise<AutoSaleOverview> {
  const db = getDatabase();
  try {
    const rows = await db.select({ deal: schema.autoSaleDeals, leadName: schema.leads.nome }).from(schema.autoSaleDeals)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.autoSaleDeals.leadId))
      .where(and(eq(schema.autoSaleDeals.tenantId, context.tenantId), context.role === "manager" ? eq(schema.autoSaleDeals.chosenBy, context.userId) : undefined))
      .orderBy(desc(schema.autoSaleDeals.createdAt)).limit(100);
    const ids = rows.map((row) => row.deal.id);
    const pending = ids.length ? await db.select({ dealId: schema.autoSaleOutbox.dealId, total: count() }).from(schema.autoSaleOutbox)
      .where(and(inArray(schema.autoSaleOutbox.dealId, ids), inArray(schema.autoSaleOutbox.status, ["draft", "held"]))).groupBy(schema.autoSaleOutbox.dealId) : [];
    const pendingMap = new Map(pending.map((row) => [row.dealId, Number(row.total)]));
    const oldest = rows.at(-1)?.deal.createdAt ?? new Date();
    const costs = await aiCostByLead(context.tenantId, rows.map((row) => row.deal.leadId), oldest);
    const flags = await readAutoSaleFlags(context.tenantId);
    const watch = await readAutoSaleWatch(context.tenantId);
    const { loadPilotForTenant } = await import("@/features/global-catalog/pilot/server");
    const catalogReady = Boolean(await loadPilotForTenant(context.tenantId).catch(() => null));
    const { readJobHeartbeats } = await import("@/features/live-status/heartbeat");
    const { jobHealth } = await import("@/features/live-status/heartbeat-format");
    const heartbeat = (await readJobHeartbeats().catch(() => new Map())).get("auto-sale") ?? null;
    const openDeal = rows.find((row) => (OPEN_DEAL_STATUSES as readonly string[]).includes(row.deal.status));
    return {
      state: "ready",
      deals: rows.map(({ deal, leadName }) => ({
        id: deal.id, leadId: deal.leadId, leadName, stage: deal.stage, status: deal.status, mode: deal.mode, channel: deal.channel,
        managerCallReason: deal.managerCallReason ? MANAGER_CALL_REASONS[deal.managerCallReason as ManagerCallReason] ?? deal.managerCallReason : null,
        pendingApprovals: pendingMap.get(deal.id) ?? 0, updatedAt: deal.updatedAt.toISOString(), createdAt: deal.createdAt.toISOString(),
        costUsd: (costs.get(deal.leadId) ?? 0) + Number(deal.transcriptionCostUsd ?? 0),
      })),
      openDealId: openDeal?.deal.id ?? null,
      autopilotAllowed: flags.autopilot,
      globalEnabled: flags.global,
      catalogReady,
      watchingSince: watch?.since ?? null,
      robot: { health: jobHealth("auto-sale", heartbeat, new Date()), lastRunAt: heartbeat?.finishedAt ?? null },
      summary: {
        total: rows.length,
        documentsRequested: rows.filter((row) => row.deal.documentsRequestedAt).length,
        managerCalls: rows.filter((row) => row.deal.managerCalledAt).length,
      },
    };
  } catch (error) {
    if (isUndefinedTableError(error)) return { state: "migration_pending" };
    throw error;
  }
}

export type DealDetail = Awaited<ReturnType<typeof getDealDetail>>;

export async function getDealDetail(context: TenantContext, dealId: string) {
  const deal = await getDeal(context.tenantId, dealId);
  if (!deal || (context.role === "manager" && deal.chosenBy !== context.userId)) return null;
  const db = getDatabase();
  const [lead] = await db.select({ nome: schema.leads.nome, telefone: schema.leads.telefone, status: schema.leads.status }).from(schema.leads).where(and(eq(schema.leads.id, deal.leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  const [turns, offers, outbox, costs] = await Promise.all([listTurns(context.tenantId, deal.id, 120), listOffers(context.tenantId, deal.id), listOutbox(context.tenantId, deal.id), aiCostByLead(context.tenantId, [deal.leadId], deal.createdAt)]);
  const firstSent = outbox.filter((item) => item.sentAt).map((item) => item.sentAt!).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const metrics = dealMetrics({
    createdAt: deal.createdAt, firstQuoteAt: deal.firstQuoteAt, documentsRequestedAt: deal.documentsRequestedAt, firstSentAt: firstSent,
    customerReplies: turns.filter((turn) => turn.direction === "in").length, offers: offers.length,
    pdfsSent: outbox.filter((item) => item.kind === "document" && item.status === "sent").length,
    managerCalls: turns.filter((turn) => turn.kind === "manager_called").map((turn) => ({ reason: turn.body ?? "" })),
    aiCostUsd: costs.get(deal.leadId) ?? 0, transcriptionCostUsd: Number(deal.transcriptionCostUsd ?? 0),
    reachedUnderAnalysis: lead?.status === "under_analysis" || lead?.status === "converted",
  });
  const handedTo = deal.handedToUserId ? (await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, deal.handedToUserId)).limit(1))[0]?.name ?? null : null;
  return {
    deal: {
      id: deal.id, leadId: deal.leadId, stage: deal.stage, status: deal.status, mode: deal.mode, channel: deal.channel,
      managerCallReason: deal.managerCallReason ? MANAGER_CALL_REASONS[deal.managerCallReason as ManagerCallReason] ?? deal.managerCallReason : null,
      createdAt: deal.createdAt.toISOString(), endedReason: deal.endedReason, handedTo, facts: deal.facts as Record<string, unknown>,
    },
    lead: { name: lead?.nome ?? "Cliente", phone: lead?.telefone ?? "", status: lead?.status ?? "" },
    // A conversa mostra os dois lados (12/11, caso Alex): o que o cliente mandou e o que a assistente enviou de fato.
    conversation: [
      ...turns.filter((turn) => turn.direction === "in").map((turn) => ({ id: turn.id, direction: turn.direction, kind: turn.kind, body: turn.body ?? "", at: turn.createdAt.toISOString() })),
      ...outbox.filter((item) => item.status === "sent" || item.status === "simulated").map((item) => ({ id: item.id, direction: "out", kind: item.kind === "text" ? "message" : `media:${item.kind}`, body: item.body || item.mediaFilename || "", at: (item.sentAt ?? item.createdAt).toISOString() })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
    decisions: turns.filter((turn) => turn.kind === "decision" || turn.kind === "manager_called" || turn.kind === "link_viewed").map((turn) => ({ id: turn.id, kind: turn.kind, intent: turn.intent, objection: turn.objection, decision: turn.decision as Record<string, unknown> | null, guard: turn.guard as unknown[] | null, model: turn.model, body: turn.body, at: turn.createdAt.toISOString() })),
    outbox: outbox.map((item) => ({ id: item.id, kind: item.kind, body: item.body ?? "", status: item.status, holdReason: item.holdReason, mediaFilename: item.mediaFilename, offerId: item.offerId, at: item.createdAt.toISOString(), sentAt: item.sentAt?.toISOString() ?? null })),
    offers: offers.map(({ snapshot, row }) => ({ id: snapshot.id, version: snapshot.version, plans: snapshot.plans.map((plan) => ({ id: plan.id, operator: plan.operator, name: plan.name, totalCents: plan.totalCents, state: plan.state })), recommendedPlanId: snapshot.recommendedPlanId, reason: snapshot.recommendationReason, relaxed: snapshot.relaxed?.label ?? null, hasPdf: Boolean(row.pdfKey), linkViews: row.publicViewCount ?? 0, at: row.createdAt.toISOString() })),
    metrics,
  };
}

/** Números WAHA da empresa em que o cliente já escreveu (anti-ban: nunca mensagem fria). */
export async function wahaNumbersForLead(context: TenantContext, leadId: string) {
  const db = getDatabase();
  const rows = await db.select({ id: schema.wahaNumbers.id, label: schema.wahaNumbers.label, phone: schema.wahaNumbers.displayPhoneNumber })
    .from(schema.wahaNumbers)
    .where(and(eq(schema.wahaNumbers.tenantId, context.tenantId), inArray(schema.wahaNumbers.status, ["active", "ready"]), inArray(schema.wahaNumbers.scope, ["tenant", "branch"]),
      sql`exists (select 1 from whatsapp_messages m where m.tenant_id = ${context.tenantId} and m.lead_id = ${leadId} and m.waha_number_id = ${schema.wahaNumbers.id} and m.direction in ('incoming', 'inbound'))`));
  return rows.map((row) => ({ id: row.id, label: row.label ?? row.phone ?? "Número da empresa" }));
}

export async function listPromotions(context: TenantContext) {
  try {
    const rows = await getDatabase().select().from(schema.autoSalePromotions).where(eq(schema.autoSalePromotions.tenantId, context.tenantId)).orderBy(desc(schema.autoSalePromotions.createdAt)).limit(50);
    return rows.map((row) => ({ id: row.id, operator: row.operator, title: row.title, description: row.description, startsOn: row.startsOn, endsOn: row.endsOn, active: row.active }));
  } catch (error) {
    if (isUndefinedTableError(error)) return [];
    throw error;
  }
}
