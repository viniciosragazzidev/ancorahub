import "server-only";

import { and, asc, count, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { calculateBrokerRankingScore, defaultIntelligentDistributionPolicy, readDistributionPolicy, type IntelligentDistributionPolicy } from "./domain";
import type { AssignmentStrategy } from "./types";
import { getDutyScheduleProfile } from "./duty-schedule-profile-queries";
import { findRunningDutySchedule, OVERNIGHT_LEADS_UNTIL } from "./duty-presence-domain";
import { operationDayStart } from "./broker-day-history";
import { countReceivedInDayByBroker, getDutyScheduleReceiptScope, NON_COUNTING_OFFER_STATUS, overnightExtraReceiptGap, type DayReceipt } from "./received-in-day";
import { getOvernightExtraShiftSettings, isDutyRotationEnabled } from "./duty-presence";
import { getSaoPauloDateKey } from "./dated-duty-roster";
import { isSkipOfferStatus, rotationArrivalOrder } from "./duty-rotation";
import { dutyQueueHistorySince, manualQueueSettingKey, parseManualQueueValue, previewQueueOrder, reconcileManualQueueOrder, type DutyQueueCandidate } from "./duty-queue-order";

export type DutyQueueOrderPreview = {
  scheduleId: string;
  dutyDate: string;
  scheduleName: string;
  queueName: string;
  strategy: AssignmentStrategy;
  order: Array<{ id: string; name: string; receivedInDuty: number; activeLeads: number; position: number; isNext: boolean; tie: boolean } & DutyBrokerTurnStats>;
  blocked: Array<{ id: string; name: string; reason: string } & DutyBrokerTurnStats>;
  savedBrokerIds: string[];
  manual: boolean;
  /** Rotation by arrival (29/10): the queue always rotates; "manual" then only means the director reordered it. */
  rotation: boolean;
  /** Offer of this plantão awaiting acceptance right now. */
  current: { id: string; name: string; offeredAt: string } | null;
  /** Last turn of this plantão before the current one. */
  previous: { id: string; name: string; offeredAt: string; outcome: "accepted" | "skip" | "waiting" } | null;
};

/** Today in this plantão, per broker: turns, skips and how fast they accept. */
export type DutyBrokerTurnStats = {
  turns: number;
  skips: number;
  accepted: number;
  avgAcceptSeconds: number | null;
  arrivedAt: string | null;
};

const ACTIVE_OFFER = new Set(["PENDING", "SENT", "DELIVERED", "READ"]);

function getBlockedReason(status: string, reason: string | null, availability: string | null) {
  if (availability && availability !== "available") return "Indisponível na equipe";
  if (reason) return reason;
  switch (status) {
    case "paused": return "Pausado neste plantão";
    case "blocked": return "Não pode receber agora";
    case "capacity_full": return "Limite de leads atingido";
    case "offer_pending": return "Oferta aguardando resposta";
    case "cooldown": return "Intervalo entre ofertas";
    default: return null;
  }
}

function summarizeBrokerHistory(
  brokerIds: readonly string[],
  leadRows: Array<{ brokerId: string | null; total: number; converted: number; unstarted: number; idleSince: Date | null }>,
  attemptRows: Array<{ brokerId: string; total: number; onTime: number; unstarted: number; idleSince: Date | null }>,
) {
  const result = new Map<string, { conversionRate: number; slaRate: number; unstartedLeads: number; idleSince: Date | null }>();
  const leadsByBroker = new Map(leadRows.map((row) => [row.brokerId, row]));
  const attemptsByBroker = new Map(attemptRows.map((row) => [row.brokerId, row]));
  for (const brokerId of brokerIds) {
    const leads = leadsByBroker.get(brokerId);
    const attempts = attemptsByBroker.get(brokerId);
    const timestamps = [leads?.idleSince, attempts?.idleSince].filter((value): value is Date => Boolean(value));
    result.set(brokerId, {
      conversionRate: leads?.total ? leads.converted / leads.total : 0,
      slaRate: attempts?.total ? attempts.onTime / attempts.total : 0,
      unstartedLeads: (leads?.unstarted ?? 0) + (attempts?.unstarted ?? 0),
      idleSince: timestamps.reduce<Date | null>((newest, value) => !newest || value > newest ? value : newest, null),
    });
  }
  return result;
}

/** Builds one compact, tenant-scoped preview for each shift running right now. */
export async function getDutyQueueOrderPreviews(context: TenantContext, now = new Date()): Promise<DutyQueueOrderPreview[]> {
  const db = getDatabase();
  const snapshot = await db.select({
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
    timezone: schema.unitDutySchedules.timezone,
    status: schema.unitDutySchedules.status,
    validFrom: schema.unitDutySchedules.validFrom,
    validUntil: schema.unitDutySchedules.validUntil,
  }).from(schema.unitDutySchedules)
    .leftJoin(schema.branches, eq(schema.unitDutySchedules.branchId, schema.branches.id))
    .leftJoin(schema.leadQueues, eq(schema.unitDutySchedules.queueId, schema.leadQueues.id))
    .where(and(
      eq(schema.unitDutySchedules.tenantId, context.tenantId),
      context.role === "manager" && context.branchId
        ? or(isNull(schema.unitDutySchedules.branchId), eq(schema.unitDutySchedules.branchId, context.branchId))
        : undefined,
    ));
  const running = snapshot.flatMap((schedule) => {
    if (schedule.status !== "active") return [];
    const occurrence = findRunningDutySchedule([schedule], now);
    return occurrence ? [{ schedule, dutyDate: occurrence.window.dutyDate }] : [];
  });
  if (!running.length) return [];

  const profiles = await Promise.all(running.map(({ schedule }) => getDutyScheduleProfile(context, schedule.id, {
    branchScopeId: context.role === "manager" ? context.branchId : null,
  })));
  const linkedQueuesByProfile = profiles.map((profile) => profile.linkedQueues.filter((queue) =>
    context.role !== "manager" || !context.branchId || queue.branchId === null || queue.branchId === context.branchId));
  const allRoster = profiles.flatMap((profile, index) => {
    const scheduleId = running[index].schedule.id;
    return profile.roster.filter((entry) => entry.status === "active" && (context.role !== "manager" || !context.branchId || entry.branchId === context.branchId)).map((entry) => ({ ...entry, scheduleId }));
  });
  const brokerIds = [...new Set(allRoster.map((row) => row.brokerId))];
  if (!brokerIds.length) return running.map(({ schedule, dutyDate }, index) => ({
    scheduleId: schedule.id,
    dutyDate,
    scheduleName: schedule.name,
    queueName: linkedQueuesByProfile[index].map((queue) => queue.name).join(", ") || "Fila geral",
    strategy: "capacity" as AssignmentStrategy,
    order: [],
    blocked: [],
    savedBrokerIds: [],
    manual: false,
    rotation: false,
    current: null,
    previous: null,
  }));

  const since = operationDayStart(now);
  const rotationEnabled = await isDutyRotationEnabled();
  const todayStart = new Date(`${getSaoPauloDateKey(now)}T00:00:00-03:00`);
  const runningIds = running.map(({ schedule }) => schedule.id);
  const [turnOffers, arrivals] = await Promise.all([
    db.select({ brokerId: schema.leadOffers.brokerId, scheduleId: schema.leadOffers.dutyScheduleId, status: schema.leadOffers.status, offeredAt: schema.leadOffers.offeredAt, acceptedAt: schema.leadOffers.acceptedAt, expiresAt: schema.leadOffers.expiresAt })
      .from(schema.leadOffers).where(and(eq(schema.leadOffers.tenantId, context.tenantId), inArray(schema.leadOffers.dutyScheduleId, runningIds), gte(schema.leadOffers.offeredAt, todayStart), ne(schema.leadOffers.status, NON_COUNTING_OFFER_STATUS)))
      .orderBy(asc(schema.leadOffers.offeredAt)),
    db.select({ brokerId: schema.dutyPresenceConfirmations.brokerId, scheduleId: schema.dutyPresenceConfirmations.scheduleId, dutyDate: schema.dutyPresenceConfirmations.dutyDate, confirmedAt: schema.dutyPresenceConfirmations.confirmedAt, photoTakenAt: schema.dutyPresenceConfirmations.photoTakenAt })
      .from(schema.dutyPresenceConfirmations).where(and(eq(schema.dutyPresenceConfirmations.tenantId, context.tenantId), inArray(schema.dutyPresenceConfirmations.scheduleId, runningIds), eq(schema.dutyPresenceConfirmations.status, "confirmed"))),
  ]);
  // Same rule as the distribution: the closed night extra's leads do not level the regular plantão.
  const extraSettings = await getOvernightExtraShiftSettings();
  const extraGap = extraSettings.enabled ? overnightExtraReceiptGap(now, extraSettings.startsAt, OVERNIGHT_LEADS_UNTIL) : null;
  const historySince = dutyQueueHistorySince(now);
  const [leadReceipts, attempts, offers, leadHistory, slaAttempts] = await Promise.all([
    db.select({ brokerId: schema.leads.corretorId, leadId: schema.leads.id, receivedAt: schema.leads.assignedAt, dutyScheduleId: schema.leads.dutyScheduleId })
      .from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, brokerIds), gte(schema.leads.assignedAt, since))),
    db.select({ brokerId: schema.leadAssignmentAttempts.brokerId, leadId: schema.leadAssignmentAttempts.leadId, receivedAt: schema.leadAssignmentAttempts.assignedAt, dutyScheduleId: schema.leadAssignmentAttempts.dutyScheduleId })
      .from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), inArray(schema.leadAssignmentAttempts.brokerId, brokerIds), gte(schema.leadAssignmentAttempts.assignedAt, since))),
    db.select({ brokerId: schema.leadOffers.brokerId, leadId: schema.leadOffers.leadId, receivedAt: schema.leadOffers.offeredAt, dutyScheduleId: schema.leadOffers.dutyScheduleId, offerStatus: schema.leadOffers.status })
      .from(schema.leadOffers).where(and(eq(schema.leadOffers.tenantId, context.tenantId), inArray(schema.leadOffers.brokerId, brokerIds), gte(schema.leadOffers.offeredAt, since), ne(schema.leadOffers.status, NON_COUNTING_OFFER_STATUS))),
    db.select({
      brokerId: schema.leads.corretorId,
      total: count(schema.leads.id),
      converted: sql<number>`count(*) filter (where ${schema.leads.status} = 'converted')`,
      unstarted: sql<number>`count(*) filter (where ${schema.leads.status} in ('distributed', 'new') or (${schema.leads.serviceStartedAt} is null and ${schema.leads.firstContactAt} is null))`,
      idleSince: sql<Date | null>`max(${schema.leads.assignedAt})`,
    }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, brokerIds), gte(schema.leads.assignedAt, historySince))).groupBy(schema.leads.corretorId),
    db.select({
      brokerId: schema.leadAssignmentAttempts.brokerId,
      total: count(schema.leadAssignmentAttempts.id),
      onTime: sql<number>`count(*) filter (where ${schema.leadAssignmentAttempts.firstContactAt} is not null and ${schema.leadAssignmentAttempts.firstContactAt} <= ${schema.leadAssignmentAttempts.feedbackDueAt})`,
      unstarted: sql<number>`count(*) filter (where ${schema.leadAssignmentAttempts.firstContactAt} is null)`,
      idleSince: sql<Date | null>`max(${schema.leadAssignmentAttempts.assignedAt})`,
    }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), inArray(schema.leadAssignmentAttempts.brokerId, brokerIds), gte(schema.leadAssignmentAttempts.assignedAt, historySince))).groupBy(schema.leadAssignmentAttempts.brokerId),
  ]);
  const receipts = [...leadReceipts, ...attempts, ...offers] as DayReceipt[];
  const historyByBroker = summarizeBrokerHistory(brokerIds, leadHistory, slaAttempts);

  const queueIds = [...new Set(linkedQueuesByProfile.flatMap((queues) => queues.filter((queue) => queue.assignmentMode === "automatic").map((queue) => queue.id)))];
  const policyRows = queueIds.length ? await db.select({ queueId: schema.leadDistributionPolicies.queueId, policy: schema.leadDistributionPolicies.policy, enabled: schema.leadDistributionPolicies.enabled })
    .from(schema.leadDistributionPolicies).where(and(eq(schema.leadDistributionPolicies.tenantId, context.tenantId), inArray(schema.leadDistributionPolicies.queueId, queueIds), isNull(schema.leadDistributionPolicies.profileKey))).orderBy(asc(schema.leadDistributionPolicies.createdAt)) : [];
  const policiesByQueue = new Map<string, { policy: IntelligentDistributionPolicy; enabled: boolean }>();
  for (const row of policyRows) if (row.queueId && !policiesByQueue.has(row.queueId)) policiesByQueue.set(row.queueId, { policy: readDistributionPolicy(row.policy), enabled: row.enabled });
  const manualScheduleByKey = new Map(running.map(({ schedule, dutyDate }) => [manualQueueSettingKey(schedule.id, dutyDate), schedule.id]));
  const manualKeys = [...manualScheduleByKey.keys()];
  const manualRows = await db.select({ key: schema.systemSettings.key, value: schema.systemSettings.value }).from(schema.systemSettings).where(inArray(schema.systemSettings.key, manualKeys));
  const manualBySchedule = new Map<string, string[]>();
  for (const row of manualRows) {
    const scheduleId = manualScheduleByKey.get(row.key);
    const order = parseManualQueueValue(row.value);
    if (scheduleId && order) manualBySchedule.set(scheduleId, order);
  }

  return running.map(({ schedule, dutyDate: occurrenceDate }, index) => {
    const roster = allRoster.filter((entry) => entry.scheduleId === schedule.id);
    const scheduleOffers = turnOffers.filter((offer) => offer.scheduleId === schedule.id);
    const arrivedAtByBroker = new Map(arrivals
      .filter((arrival) => arrival.scheduleId === schedule.id && arrival.dutyDate === occurrenceDate && arrival.confirmedAt)
      // Presencial (30/10): the photo time is the arrival, not the approval.
      .map((arrival) => [arrival.brokerId, arrival.photoTakenAt ?? arrival.confirmedAt!] as const));
    const statsOf = (brokerId: string): DutyBrokerTurnStats => {
      const offersOfBroker = scheduleOffers.filter((offer) => offer.brokerId === brokerId);
      const acceptSeconds = offersOfBroker.flatMap((offer) => offer.acceptedAt ? [(offer.acceptedAt.getTime() - offer.offeredAt.getTime()) / 1000] : []);
      return {
        turns: offersOfBroker.length,
        skips: offersOfBroker.filter((offer) => isSkipOfferStatus(offer.status)).length,
        accepted: offersOfBroker.filter((offer) => offer.status === "ACCEPTED").length,
        avgAcceptSeconds: acceptSeconds.length ? Math.round(acceptSeconds.reduce((total, value) => total + value, 0) / acceptSeconds.length) : null,
        arrivedAt: arrivedAtByBroker.get(brokerId)?.toISOString() ?? null,
      };
    };
    const nameOf = (brokerId: string) => roster.find((entry) => entry.brokerId === brokerId)?.brokerName ?? "Corretor";
    const activeOffer = [...scheduleOffers].reverse().find((offer) => ACTIVE_OFFER.has(offer.status) && offer.expiresAt > now) ?? null;
    const lastTurn = [...scheduleOffers].reverse().find((offer) => offer !== activeOffer) ?? null;
    const scheduleBrokerIds = roster.map((entry) => entry.brokerId);
    const scheduleIdByBroker = Object.fromEntries(scheduleBrokerIds.map((brokerId) => [brokerId, schedule.id]));
    const accessibleQueues = linkedQueuesByProfile[index];
    const linked = accessibleQueues.filter((queue) => queue.assignmentMode === "automatic");
    const operatingQueue = linked[0] ?? null;
    const queuePolicy = operatingQueue ? policiesByQueue.get(operatingQueue.id) : null;
    const policy = queuePolicy?.policy ?? defaultIntelligentDistributionPolicy;
    const strategy = operatingQueue?.assignmentStrategy === "round_robin" ? "round_robin" : "capacity";
    const hasExplicitDutyScope = Boolean(operatingQueue && (operatingQueue.exclusiveDutyScheduleIds?.includes(schedule.id) || operatingQueue.exclusiveDutyScheduleId === schedule.id));
    const countingScope = countReceivedInDayByBroker(receipts, since, getDutyScheduleReceiptScope(scheduleIdByBroker, hasExplicitDutyScope), extraGap);
    const pausedBrokerIds = new Set(roster.filter((entry) => entry.pausedAt).map((entry) => entry.brokerId));
    const candidates: DutyQueueCandidate[] = roster.map((entry) => {
      const history = historyByBroker.get(entry.brokerId);
      const candidate = {
        id: entry.brokerId,
        name: entry.brokerName,
        createdAt: entry.createdAt,
        activeLeads: entry.activeLeads,
        capacity: entry.capacity,
        onDuty: true,
        receivedInDuty: countingScope.get(entry.brokerId) ?? 0,
        conversionRate: history?.conversionRate ?? 0,
        slaRate: history?.slaRate ?? 0,
        manualPriority: 0,
        idleSince: history?.idleSince ?? null,
        unstartedLeads: history?.unstartedLeads ?? 0,
        rankingScore: 0,
        blockedReason: pausedBrokerIds.has(entry.brokerId)
          ? "Pausado neste plantão"
          : getBlockedReason(entry.liveStatus, entry.blockedReason, entry.availabilityStatus),
      };
      return { ...candidate, rankingScore: calculateBrokerRankingScore(candidate, policy) };
    }).map((candidate) => {
      if (queuePolicy?.enabled === false) return { ...candidate, blockedReason: "Distribuição pausada nesta fila" };
      if (policy.excludedBrokerIds.includes(candidate.id)) return { ...candidate, blockedReason: "Excluído da política da fila" };
      if (policy.allowedBrokerIds?.length && !policy.allowedBrokerIds.includes(candidate.id)) return { ...candidate, blockedReason: "Fora da política da fila" };
      return candidate;
    });
    // Rotation: the saved queue or, before the first lead, the order of arrival; late arrivals go to the end.
    const rotation = rotationEnabled && hasExplicitDutyScope;
    const arrivalOrder = rotationArrivalOrder(roster.map((entry) => ({ brokerId: entry.brokerId, arrivedAt: arrivedAtByBroker.get(entry.brokerId) ?? null })));
    const rotationOrder = rotation ? reconcileManualQueueOrder(manualBySchedule.get(schedule.id) ?? [], arrivalOrder) : null;
    const preview = previewQueueOrder({
      candidates,
      policy,
      strategy,
      receivedByBroker: countingScope,
      tierByBroker: Object.fromEntries(scheduleBrokerIds.map((brokerId) => [brokerId, 0])),
      manualBrokerIds: rotationOrder ?? manualBySchedule.get(schedule.id),
    });
    const savedBrokerIds = reconcileManualQueueOrder(
      manualBySchedule.get(schedule.id) ?? [...preview.order.map((candidate) => candidate.id), ...preview.blocked.map((candidate) => candidate.id)],
      roster.map((entry) => entry.brokerId),
    );
    const tied = new Set(preview.tiedBrokerIds);
    return {
      scheduleId: schedule.id,
      dutyDate: occurrenceDate,
      scheduleName: schedule.name,
      queueName: linked.map((queue) => queue.name).join(", ") || accessibleQueues.map((queue) => queue.name).join(", ") || "Fila geral",
      strategy,
      order: preview.order.map((candidate, position) => ({ id: candidate.id, name: candidate.name, receivedInDuty: candidate.receivedInDuty ?? 0, activeLeads: candidate.activeLeads, position: position + 1, isNext: candidate.id === preview.nextBrokerId, tie: tied.has(candidate.id), ...statsOf(candidate.id) })),
      blocked: preview.blocked.map((candidate) => ({ id: candidate.id, name: candidate.name, reason: candidate.blockedReason, ...statsOf(candidate.id) })),
      savedBrokerIds,
      manual: rotation ? false : preview.manual,
      rotation,
      current: activeOffer ? { id: activeOffer.brokerId, name: nameOf(activeOffer.brokerId), offeredAt: activeOffer.offeredAt.toISOString() } : null,
      previous: lastTurn ? {
        id: lastTurn.brokerId,
        name: nameOf(lastTurn.brokerId),
        offeredAt: lastTurn.offeredAt.toISOString(),
        outcome: lastTurn.status === "ACCEPTED" ? "accepted" : isSkipOfferStatus(lastTurn.status) ? "skip" : "waiting",
      } : null,
    };
  });
}
