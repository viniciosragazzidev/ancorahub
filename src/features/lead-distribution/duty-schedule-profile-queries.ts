import "server-only";

import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { getFeatureFlag, FEATURE_FLAGS } from "@/features/system-settings/queries";
import { getDutyOccurrenceLeadWindow, getRelevantDutyWindow, resolveDutyLeadWindowBounds } from "./duty-presence-domain";
import { normalizeOfferPacing } from "./offer-pacing";
import { classifyBrokerLiveOfferStatus } from "./duty-roster-live-status";

// Upper bound on how far back a lead can show even when the schedule has no
// completed occurrence yet (brand-new schedule) — keeps the query sane.
const LEADS_LIMIT = 200;
// Same set the distribution engine uses to count a broker's active load against
// queue capacity (service.ts's local `activeCommercialStatuses`) — kept in sync
// by hand since neither file exports a shared constant.
const ACTIVE_COMMERCIAL_STATUSES = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export type DutyScheduleProfile = Awaited<ReturnType<typeof getDutyScheduleProfile>>;

/**
 * Full picture of one plantão occurrence-family: the schedule itself, who is
 * scheduled on it right now, which queues route leads into it (legacy single
 * link, current plural link, or the schedule's own legacy queueId — a plantão
 * can be wired to a queue through any of the three), and the leads that
 * actually landed with one of its rostered brokers recently.
 */
export async function getDutyScheduleProfile(context: TenantContext, scheduleId: string) {
  const db = getDatabase();

  const [schedule] = await db
    .select({
      id: schema.unitDutySchedules.id,
      tenantId: schema.unitDutySchedules.tenantId,
      branchId: schema.unitDutySchedules.branchId,
      branchName: schema.branches.name,
      legacyQueueId: schema.unitDutySchedules.queueId,
      legacyQueueName: schema.leadQueues.name,
      name: schema.unitDutySchedules.name,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      priority: schema.unitDutySchedules.priority,
      minimumBrokers: schema.unitDutySchedules.minimumBrokers,
      status: schema.unitDutySchedules.status,
      timezone: schema.unitDutySchedules.timezone,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
    })
    .from(schema.unitDutySchedules)
    .leftJoin(schema.branches, eq(schema.unitDutySchedules.branchId, schema.branches.id))
    .leftJoin(schema.leadQueues, eq(schema.unitDutySchedules.queueId, schema.leadQueues.id))
    .where(and(eq(schema.unitDutySchedules.id, scheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .limit(1);
  if (!schedule) throw new Error("Plantão não encontrado.");
  if (context.role === "manager" && context.branchId && schedule.branchId && schedule.branchId !== context.branchId) {
    throw new AuthorizationError("Este plantão está fora da sua unidade.");
  }

  const roster = await db
    .select({
      id: schema.dutyRosterAssignments.id,
      brokerId: schema.dutyRosterAssignments.brokerId,
      brokerName: schema.user.name,
      internalCode: schema.brokerProfiles.internalCode,
      phone: schema.brokerProfiles.phone,
      userActive: schema.user.active,
      membershipStatus: schema.tenantMemberships.status,
      availabilityStatus: schema.tenantMemberships.availabilityStatus,
      status: schema.dutyRosterAssignments.status,
      pausedAt: schema.dutyRosterAssignments.pausedAt,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      validFrom: schema.dutyRosterAssignments.validFrom,
      validUntil: schema.dutyRosterAssignments.validUntil,
    })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.user, eq(schema.dutyRosterAssignments.brokerId, schema.user.id))
    .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, context.tenantId)))
    .leftJoin(schema.tenantMemberships, and(eq(schema.tenantMemberships.userId, schema.user.id), eq(schema.tenantMemberships.tenantId, context.tenantId)))
    .where(and(eq(schema.dutyRosterAssignments.scheduleId, scheduleId), eq(schema.dutyRosterAssignments.status, "active")))
    .orderBy(asc(schema.user.name));

  const linkedQueues = await db
    .select({
      id: schema.leadQueues.id,
      name: schema.leadQueues.name,
      branchName: schema.branches.name,
      assignmentMode: schema.leadQueues.assignmentMode,
      capacityEnabled: schema.leadQueues.capacityEnabled,
      capacityPerBroker: schema.leadQueues.capacityPerBroker,
      offerIntervalMinutes: schema.leadQueues.offerIntervalMinutes,
      maxPendingOffersPerBroker: schema.leadQueues.maxPendingOffersPerBroker,
      exclusiveDutyScheduleId: schema.leadQueues.exclusiveDutyScheduleId,
      exclusiveDutyScheduleIds: schema.leadQueues.exclusiveDutyScheduleIds,
    })
    .from(schema.leadQueues)
    .leftJoin(schema.branches, eq(schema.leadQueues.branchId, schema.branches.id))
    .where(and(
      eq(schema.leadQueues.tenantId, context.tenantId),
      isNull(schema.leadQueues.deletedAt),
      or(
        eq(schema.leadQueues.exclusiveDutyScheduleId, scheduleId),
        sql`${schema.leadQueues.exclusiveDutyScheduleIds} @> ${JSON.stringify([scheduleId])}::jsonb`,
        schedule.legacyQueueId ? eq(schema.leadQueues.id, schedule.legacyQueueId) : sql`false`,
      ),
    ));
  // The queue the live offer status is computed against: the first automatic
  // one if there is any (matches what the distribution engine actually runs),
  // otherwise the first linked queue so a manual-only plantão still shows
  // capacity, just with no pacing countdown to expect.
  const operatingQueue = linkedQueues.find((queue) => queue.assignmentMode === "automatic") ?? linkedQueues[0] ?? null;
  const pacing = normalizeOfferPacing(operatingQueue ? { intervalMinutes: operatingQueue.offerIntervalMinutes, maxPending: operatingQueue.maxPendingOffersPerBroker } : null);
  const operatingCapacity = operatingQueue?.capacityEnabled ? operatingQueue.capacityPerBroker ?? null : null;

  const queueIds = linkedQueues.map((queue) => queue.id);
  const now = new Date();

  // A plantão is commonly one row per weekday sharing the same queue(s)
  // (Mon..Fri as five separate schedules). The lower bound of "leads that
  // belong to this occurrence" needs every sibling in that rotation to find
  // the *actual* previous occurrence — usually a different weekday's
  // schedule (yesterday's close), not this same schedule a week back.
  const familyScheduleIds = new Set<string>([scheduleId]);
  for (const queue of linkedQueues) {
    if (queue.exclusiveDutyScheduleId) familyScheduleIds.add(queue.exclusiveDutyScheduleId);
    for (const id of queue.exclusiveDutyScheduleIds ?? []) familyScheduleIds.add(id);
  }
  const familySchedules = familyScheduleIds.size > 1
    ? await db.select({ dayOfWeek: schema.unitDutySchedules.dayOfWeek, startsAt: schema.unitDutySchedules.startsAt, endsAt: schema.unitDutySchedules.endsAt, timezone: schema.unitDutySchedules.timezone })
      .from(schema.unitDutySchedules)
      .where(and(eq(schema.unitDutySchedules.tenantId, context.tenantId), inArray(schema.unitDutySchedules.id, [...familyScheduleIds])))
    : [{ dayOfWeek: schedule.dayOfWeek, startsAt: schedule.startsAt, endsAt: schedule.endsAt, timezone: schedule.timezone }];

  // Only leads that actually belong to this specific occurrence: the one
  // currently running (open-ended — still collecting) or, once it's closed,
  // bounded to exactly its own start/end. Without the upper bound, an
  // already-closed occurrence's page kept absorbing whatever arrived after
  // it ended — including a different day's own leads.
  const occurrenceWindow = getDutyOccurrenceLeadWindow({ dayOfWeek: schedule.dayOfWeek, startsAt: schedule.startsAt, endsAt: schedule.endsAt, timezone: schedule.timezone }, familySchedules, now);
  const { since, until } = resolveDutyLeadWindowBounds(occurrenceWindow, now);

  // Every lead routed through this plantão's queues — waiting, offered,
  // distributed or in service — not only the ones already with a rostered broker.
  const leads = queueIds.length
    ? await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        distributionStatus: schema.leads.distributionStatus,
        corretorId: schema.leads.corretorId,
        brokerName: schema.user.name,
        queueId: schema.leads.queueId,
        queueName: schema.leadQueues.name,
        assignedAt: schema.leads.assignedAt,
        createdAt: schema.leads.createdAt,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.leadQueues, eq(schema.leads.queueId, schema.leadQueues.id))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        inArray(schema.leads.queueId, queueIds),
        or(
          and(gte(schema.leads.createdAt, since), until ? lte(schema.leads.createdAt, until) : undefined),
          and(gte(schema.leads.assignedAt, since), until ? lte(schema.leads.assignedAt, until) : undefined),
        ),
        isNull(schema.leads.deletedAt),
        isNull(schema.leads.archivedAt),
      ))
      .orderBy(desc(schema.leads.createdAt))
      .limit(LEADS_LIMIT)
    : [];

  const leadsPerBroker = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.corretorId) continue;
    leadsPerBroker.set(lead.corretorId, (leadsPerBroker.get(lead.corretorId) ?? 0) + 1);
  }

  const presenceEnabled = (await getFeatureFlag(FEATURE_FLAGS.DUTY_PRESENCE_CONFIRMATION)) === "true";
  const occurrenceByAssignment = new Map(roster.flatMap((entry) => {
    const occurrence = getRelevantDutyWindow({
      dayOfWeek: entry.dayOfWeek,
      startsAt: entry.startsAt,
      endsAt: entry.endsAt,
      timezone: schedule.timezone,
    }, now, 24 * 60);
    return occurrence && occurrence.startsAt >= entry.validFrom && (!entry.validUntil || occurrence.startsAt < entry.validUntil)
      ? [[entry.id, occurrence] as const]
      : [];
  }));
  const dutyDates = [...new Set([...occurrenceByAssignment.values()].map((occurrence) => occurrence.dutyDate))];
  const presenceRows = presenceEnabled && dutyDates.length
    ? await db.select({
      assignmentId: schema.dutyPresenceConfirmations.assignmentId,
      dutyDate: schema.dutyPresenceConfirmations.dutyDate,
      status: schema.dutyPresenceConfirmations.status,
      confirmedAt: schema.dutyPresenceConfirmations.confirmedAt,
      notificationStatus: schema.dutyPresenceConfirmations.notificationStatus,
      notificationErrorCode: schema.dutyPresenceConfirmations.notificationErrorCode,
    }).from(schema.dutyPresenceConfirmations).where(and(
      eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId),
      eq(schema.dutyPresenceConfirmations.scheduleId, scheduleId),
      inArray(schema.dutyPresenceConfirmations.assignmentId, [...occurrenceByAssignment.keys()]),
      inArray(schema.dutyPresenceConfirmations.dutyDate, dutyDates),
    ))
    : [];
  const presenceByAssignment = new Map(presenceRows.map((row) => [`${row.assignmentId}:${row.dutyDate}`, row]));

  // Live offer status: how many leads the broker is actively carrying for the
  // operating queue right now (the exact rule the distribution engine checks
  // against capacity), plus their offers in the pacing lookback window.
  const brokerIds = roster.map((entry) => entry.brokerId);
  const [activeLoadRows, recentOfferRows] = operatingQueue && brokerIds.length
    ? await Promise.all([
      db.select({ brokerId: schema.leads.corretorId, total: sql<number>`count(*)::int` })
        .from(schema.leads)
        .where(and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.queueId, operatingQueue.id),
          inArray(schema.leads.corretorId, brokerIds),
          inArray(schema.leads.status, ACTIVE_COMMERCIAL_STATUSES),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
        ))
        .groupBy(schema.leads.corretorId),
      db.select({ brokerId: schema.leadOffers.brokerId, status: schema.leadOffers.status, offeredAt: schema.leadOffers.offeredAt, expiresAt: schema.leadOffers.expiresAt })
        .from(schema.leadOffers)
        .innerJoin(schema.leads, eq(schema.leadOffers.leadId, schema.leads.id))
        .where(and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leads.queueId, operatingQueue.id),
          inArray(schema.leadOffers.brokerId, brokerIds),
          or(
            gte(schema.leadOffers.offeredAt, new Date(now.getTime() - Math.max(pacing.intervalMinutes, 1) * 60_000)),
            gt(schema.leadOffers.expiresAt, now),
          ),
        )),
    ])
    : [[], []];
  const activeLoadByBroker = new Map(activeLoadRows.map((row) => [row.brokerId, Number(row.total)]));
  const offersByBroker = new Map<string, typeof recentOfferRows>();
  for (const offer of recentOfferRows) {
    const list = offersByBroker.get(offer.brokerId);
    if (list) list.push(offer); else offersByBroker.set(offer.brokerId, [offer]);
  }

  return {
    schedule: {
      ...schedule,
      queueName: schedule.legacyQueueName ?? (linkedQueues.length ? linkedQueues.map((queue) => queue.name).join(", ") : "Nenhuma fila vinculada"),
    },
    presenceEnabled,
    roster: roster.map(({ phone, userActive, membershipStatus, dayOfWeek, startsAt, endsAt, validFrom, validUntil, ...entry }) => {
      const occurrence = occurrenceByAssignment.get(entry.id);
      const presence = occurrence ? presenceByAssignment.get(`${entry.id}:${occurrence.dutyDate}`) : null;
      // Same prerequisites the distribution engine applies before offering a lead.
      const blockedReason = !userActive || membershipStatus !== "active" ? "Conta inativa" : !phone ? "Sem telefone cadastrado (não recebe ofertas)" : presenceEnabled && occurrence && presence?.status !== "confirmed" ? "Aguardando confirmação do plantão" : null;
      const liveStatus = classifyBrokerLiveOfferStatus({
        paused: Boolean(entry.pausedAt),
        blockedReason,
        capacity: operatingCapacity,
        activeLeads: activeLoadByBroker.get(entry.brokerId) ?? 0,
        pacing,
        offers: offersByBroker.get(entry.brokerId) ?? [],
        now,
      });
      return {
      ...entry,
      leadsInWindow: leadsPerBroker.get(entry.brokerId) ?? 0,
      blockedReason,
      presenceStatus: !presenceEnabled || !occurrence ? "not_requested" as const : presence?.status === "confirmed" ? "confirmed" as const : "pending" as const,
      confirmedAt: presence?.confirmedAt ?? null,
      notificationStatus: presence?.notificationStatus ?? null,
      notificationErrorCode: presence?.notificationErrorCode ?? null,
      dutyDate: occurrence?.dutyDate ?? null,
      liveStatus: liveStatus.status,
      nextEventAt: liveStatus.nextEventAt,
      activeLeads: activeLoadByBroker.get(entry.brokerId) ?? 0,
      capacity: operatingCapacity,
      };
    }),
    linkedQueues,
    leads,
    leadsSince: since,
    leadsUntil: until,
    liveStatusEnabled: Boolean(operatingQueue),
  };
}
