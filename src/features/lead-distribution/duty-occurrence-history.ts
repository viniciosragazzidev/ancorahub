import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, gt, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import type { DutyWindow } from "./duty-presence-domain";

const HISTORY_LIMIT = 200;

/** Read-only reconstruction. Old queue events may not identify the exact plantão. */
export async function getDutyOccurrenceHistory(
  context: TenantContext,
  scheduleId: string,
  queueIds: string[],
  window: DutyWindow,
) {
  const db = getDatabase();
  const roster = await db.select({
    id: schema.dutyRosterAssignments.id,
    brokerId: schema.dutyRosterAssignments.brokerId,
    brokerName: schema.user.name,
    branchId: schema.dutyRosterAssignments.branchId,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
      eq(schema.dutyRosterAssignments.scheduleId, scheduleId),
      or(isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.dutyDate, window.dutyDate)),
      lte(schema.dutyRosterAssignments.validFrom, window.startsAt),
      or(gt(schema.dutyRosterAssignments.validUntil, window.startsAt), isNull(schema.dutyRosterAssignments.validUntil)),
      context.role === "manager" && context.branchId ? eq(schema.dutyRosterAssignments.branchId, context.branchId) : undefined,
    )).orderBy(asc(schema.user.name));

  const [offers, manualEvents, offerEvents, presenceRows] = await Promise.all([
    db.select({
      id: schema.leadOffers.id,
      leadId: schema.leadOffers.leadId,
      leadName: schema.leads.nome,
      brokerId: schema.leadOffers.brokerId,
      brokerName: schema.user.name,
      queueId: schema.leads.queueId,
      status: schema.leadOffers.status,
      assignedAt: schema.leadOffers.acceptedAt,
      offeredAt: schema.leadOffers.offeredAt,
    }).from(schema.leadOffers)
      .innerJoin(schema.leads, and(eq(schema.leadOffers.leadId, schema.leads.id), eq(schema.leads.tenantId, context.tenantId)))
      .innerJoin(schema.user, eq(schema.leadOffers.brokerId, schema.user.id))
      .where(and(
        eq(schema.leadOffers.tenantId, context.tenantId),
        or(
          queueIds.length ? inArray(schema.leads.queueId, queueIds) : sql`false`,
          sql`exists (select 1 from lead_distribution_events duty_event where duty_event.tenant_id = ${context.tenantId} and duty_event.action = 'offer_sent' and duty_event.metadata->>'offerId' = ${schema.leadOffers.id} and duty_event.metadata->>'scheduleId' = ${scheduleId} and duty_event.metadata->>'dutyDate' = ${window.dutyDate})`,
        ),
        gte(schema.leadOffers.offeredAt, window.startsAt),
        lt(schema.leadOffers.offeredAt, window.endsAt),
        context.role === "manager" && context.branchId ? sql`exists (select 1 from lead_distribution_events scoped_offer where scoped_offer.tenant_id = ${context.tenantId} and scoped_offer.lead_id = ${schema.leadOffers.leadId} and scoped_offer.new_owner_id = ${schema.leadOffers.brokerId} and scoped_offer.action = 'offer_sent' and scoped_offer.to_branch_id = ${context.branchId} and scoped_offer.created_at >= ${window.startsAt} and scoped_offer.created_at < ${window.endsAt})` : undefined,
      )).orderBy(asc(schema.leadOffers.offeredAt)).limit(HISTORY_LIMIT + 1),
    db.select({
      id: schema.leadDistributionEvents.id,
      leadId: schema.leadDistributionEvents.leadId,
      leadName: schema.leads.nome,
      brokerId: schema.leadDistributionEvents.newOwnerId,
      brokerName: schema.user.name,
      queueId: schema.leadDistributionEvents.toQueueId,
      assignedAt: schema.leadDistributionEvents.createdAt,
      metadata: schema.leadDistributionEvents.metadata,
    }).from(schema.leadDistributionEvents)
      .innerJoin(schema.leads, and(eq(schema.leadDistributionEvents.leadId, schema.leads.id), eq(schema.leads.tenantId, context.tenantId)))
      .leftJoin(schema.user, eq(schema.leadDistributionEvents.newOwnerId, schema.user.id))
      .where(and(
        eq(schema.leadDistributionEvents.tenantId, context.tenantId),
        inArray(schema.leadDistributionEvents.action, ["assigned", "routed_and_assigned"]),
        or(
          queueIds.length ? inArray(schema.leadDistributionEvents.toQueueId, queueIds) : sql`false`,
          sql`${schema.leadDistributionEvents.metadata}->>'dutyScheduleId' = ${scheduleId} and ${schema.leadDistributionEvents.metadata}->>'dutyDate' = ${window.dutyDate}`,
        ),
        isNotNull(schema.leadDistributionEvents.newOwnerId),
        gte(schema.leadDistributionEvents.createdAt, window.startsAt),
        lt(schema.leadDistributionEvents.createdAt, window.endsAt),
        context.role === "manager" && context.branchId ? eq(schema.leadDistributionEvents.toBranchId, context.branchId) : undefined,
      )).orderBy(asc(schema.leadDistributionEvents.createdAt)).limit(HISTORY_LIMIT + 1),
    db.select({ metadata: schema.leadDistributionEvents.metadata })
      .from(schema.leadDistributionEvents)
      .where(and(
        eq(schema.leadDistributionEvents.tenantId, context.tenantId),
        eq(schema.leadDistributionEvents.action, "offer_sent"),
        or(
          queueIds.length ? inArray(schema.leadDistributionEvents.toQueueId, queueIds) : sql`false`,
          sql`${schema.leadDistributionEvents.metadata}->>'scheduleId' = ${scheduleId} and ${schema.leadDistributionEvents.metadata}->>'dutyDate' = ${window.dutyDate}`,
        ),
        gte(schema.leadDistributionEvents.createdAt, window.startsAt),
        lt(schema.leadDistributionEvents.createdAt, window.endsAt),
        context.role === "manager" && context.branchId ? eq(schema.leadDistributionEvents.toBranchId, context.branchId) : undefined,
      )).limit(HISTORY_LIMIT + 1),
    db.select({ status: schema.dutyPresenceConfirmations.status })
      .from(schema.dutyPresenceConfirmations)
      .where(and(
        eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId),
        eq(schema.dutyPresenceConfirmations.scheduleId, scheduleId),
        eq(schema.dutyPresenceConfirmations.dutyDate, window.dutyDate),
        context.role === "manager" && context.branchId ? sql`exists (select 1 from duty_roster_assignments scoped_roster where scoped_roster.id = ${schema.dutyPresenceConfirmations.assignmentId} and scoped_roster.tenant_id = ${context.tenantId} and scoped_roster.branch_id = ${context.branchId})` : undefined,
      )),
  ]);
  const exactOfferIds = new Set(offerEvents.flatMap((event) => {
    const metadata = event.metadata as { offerId?: unknown; scheduleId?: unknown; dutyDate?: unknown } | null;
    return metadata?.scheduleId === scheduleId && metadata.dutyDate === window.dutyDate && typeof metadata.offerId === "string" ? [metadata.offerId] : [];
  }));

  const distributions = [
    ...offers.filter((row) => row.assignedAt).map((row) => ({
      id: row.id, leadId: row.leadId, leadName: row.leadName,
      brokerId: row.brokerId, brokerName: row.brokerName,
      assignedAt: row.assignedAt!, kind: "Aceite da oferta", exact: exactOfferIds.has(row.id),
    })),
    ...manualEvents.filter((row) => row.brokerId).map((row) => ({
      id: row.id, leadId: row.leadId, leadName: row.leadName,
      brokerId: row.brokerId!, brokerName: row.brokerName ?? "Corretor não encontrado",
      assignedAt: row.assignedAt, kind: "Atribuição manual",
      exact: (row.metadata as { dutyScheduleId?: unknown } | null)?.dutyScheduleId === scheduleId,
    })),
  ].sort((first, second) => first.assignedAt.getTime() - second.assignedAt.getTime()).slice(0, HISTORY_LIMIT);

  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "duty_occurrence", entidadeId: `${scheduleId}:${window.dutyDate}`, acao: "duty_occurrence_history.viewed" });

  return {
    roster, distributions,
    offers: { total: offers.length, accepted: offers.filter((row) => row.status === "ACCEPTED").length, declined: offers.filter((row) => row.status === "DECLINED").length, expired: offers.filter((row) => row.status === "EXPIRED").length },
    confirmations: { total: presenceRows.length, confirmed: presenceRows.filter((row) => row.status === "confirmed").length },
    truncated: offers.length > HISTORY_LIMIT || manualEvents.length > HISTORY_LIMIT || offerEvents.length > HISTORY_LIMIT,
  };
}
