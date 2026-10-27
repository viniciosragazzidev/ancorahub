import "server-only";

import { and, asc, count, eq, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { calculateBrokerRankingScore, defaultIntelligentDistributionPolicy, readDistributionPolicy, type IntelligentDistributionPolicy } from "./domain";
import type { AssignmentStrategy } from "./types";
import { getDutyScheduleProfile } from "./duty-schedule-profile-queries";
import { findRunningDutySchedule } from "./duty-presence-domain";
import { operationDayStart } from "./broker-day-history";
import { countReceivedInDayByBroker, NON_COUNTING_OFFER_STATUS, type DayReceipt } from "./received-in-day";
import { parseManualQueueValue, previewQueueOrder, reconcileManualQueueOrder, type DutyQueueCandidate } from "./duty-queue-order";

export type DutyQueueOrderPreview = {
  scheduleId: string;
  dutyDate: string;
  scheduleName: string;
  queueName: string;
  strategy: AssignmentStrategy;
  order: Array<{ id: string; name: string; receivedInDuty: number; activeLeads: number; position: number; isNext: boolean; tie: boolean }>;
  blocked: Array<{ id: string; name: string; reason: string }>;
  savedBrokerIds: string[];
  manual: boolean;
};

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
  }));

  const since = operationDayStart(now);
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
    }).from(schema.leads).where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.corretorId, brokerIds))).groupBy(schema.leads.corretorId),
    db.select({
      brokerId: schema.leadAssignmentAttempts.brokerId,
      total: count(schema.leadAssignmentAttempts.id),
      onTime: sql<number>`count(*) filter (where ${schema.leadAssignmentAttempts.firstContactAt} is not null and ${schema.leadAssignmentAttempts.firstContactAt} <= ${schema.leadAssignmentAttempts.feedbackDueAt})`,
      unstarted: sql<number>`count(*) filter (where ${schema.leadAssignmentAttempts.firstContactAt} is null)`,
      idleSince: sql<Date | null>`max(${schema.leadAssignmentAttempts.assignedAt})`,
    }).from(schema.leadAssignmentAttempts).where(and(eq(schema.leadAssignmentAttempts.tenantId, context.tenantId), inArray(schema.leadAssignmentAttempts.brokerId, brokerIds))).groupBy(schema.leadAssignmentAttempts.brokerId),
  ]);
  const receipts = [...leadReceipts, ...attempts, ...offers] as DayReceipt[];
  const historyByBroker = summarizeBrokerHistory(brokerIds, leadHistory, slaAttempts);

  const queueIds = [...new Set(linkedQueuesByProfile.flatMap((queues) => queues.filter((queue) => queue.assignmentMode === "automatic").map((queue) => queue.id)))];
  const policyRows = queueIds.length ? await db.select({ queueId: schema.leadDistributionPolicies.queueId, policy: schema.leadDistributionPolicies.policy, enabled: schema.leadDistributionPolicies.enabled })
    .from(schema.leadDistributionPolicies).where(and(eq(schema.leadDistributionPolicies.tenantId, context.tenantId), inArray(schema.leadDistributionPolicies.queueId, queueIds), isNull(schema.leadDistributionPolicies.profileKey))).orderBy(asc(schema.leadDistributionPolicies.createdAt)) : [];
  const policiesByQueue = new Map<string, { policy: IntelligentDistributionPolicy; enabled: boolean }>();
  for (const row of policyRows) if (row.queueId && !policiesByQueue.has(row.queueId)) policiesByQueue.set(row.queueId, { policy: readDistributionPolicy(row.policy), enabled: row.enabled });
  const manualScheduleByKey = new Map(running.map(({ schedule, dutyDate }) => [`manual-queue:${schedule.id}:${dutyDate}`, schedule.id]));
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
    const scheduleBrokerIds = roster.map((entry) => entry.brokerId);
    const scheduleIdByBroker = Object.fromEntries(scheduleBrokerIds.map((brokerId) => [brokerId, schedule.id]));
    const received = countReceivedInDayByBroker(receipts, since, scheduleIdByBroker);
    const accessibleQueues = linkedQueuesByProfile[index];
    const linked = accessibleQueues.filter((queue) => queue.assignmentMode === "automatic");
    const operatingQueue = linked[0] ?? null;
    const queuePolicy = operatingQueue ? policiesByQueue.get(operatingQueue.id) : null;
    const policy = queuePolicy?.policy ?? defaultIntelligentDistributionPolicy;
    const strategy = operatingQueue?.assignmentStrategy === "round_robin" ? "round_robin" : "capacity";
    const usesScheduleReceiptScope = Boolean(operatingQueue && (operatingQueue.exclusiveDutyScheduleIds?.includes(schedule.id) || operatingQueue.exclusiveDutyScheduleId === schedule.id));
    const countingScope = usesScheduleReceiptScope ? received : countReceivedInDayByBroker(receipts, since, {});
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
    const preview = previewQueueOrder({
      candidates,
      policy,
      strategy,
      receivedByBroker: countingScope,
      tierByBroker: Object.fromEntries(scheduleBrokerIds.map((brokerId) => [brokerId, 0])),
      manualBrokerIds: manualBySchedule.get(schedule.id),
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
      order: preview.order.map((candidate, position) => ({ id: candidate.id, name: candidate.name, receivedInDuty: candidate.receivedInDuty ?? 0, activeLeads: candidate.activeLeads, position: position + 1, isNext: candidate.id === preview.nextBrokerId, tie: tied.has(candidate.id) })),
      blocked: preview.blocked.map((candidate) => ({ id: candidate.id, name: candidate.name, reason: candidate.blockedReason })),
      savedBrokerIds,
      manual: preview.manual,
    };
  });
}
