import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { lockMonthlyDutyPlans } from "./monthly-duty-plan-assignments";
import { dayOfWeekOf, isMonthlyOccurrenceEnded, occurrenceValidity, type MonthlyPlanAssignment, type MonthlyPlanOccurrence } from "./monthly-duty-plan";

type Tx = Parameters<Parameters<ReturnType<typeof getDatabase>["transaction"]>[0]>[0];

/** Invited brokers (registered, no account yet) put on this plantão: shown as "Convite pendente". */
export async function listPendingRosterEntries(tenantId: string, scheduleId: string) {
  return getDatabase()
    .select({
      id: schema.dutyRosterPending.id,
      brokerProfileId: schema.dutyRosterPending.brokerProfileId,
      name: schema.brokerProfiles.professionalName,
      internalCode: schema.brokerProfiles.internalCode,
      branchName: schema.branches.name,
    })
    .from(schema.dutyRosterPending)
    .innerJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.id, schema.dutyRosterPending.brokerProfileId), eq(schema.brokerProfiles.tenantId, tenantId)))
    .leftJoin(schema.branches, eq(schema.branches.id, schema.brokerProfiles.branchId))
    .where(and(eq(schema.dutyRosterPending.tenantId, tenantId), eq(schema.dutyRosterPending.scheduleId, scheduleId)))
    .orderBy(asc(schema.brokerProfiles.professionalName));
}

/**
 * Brokers registered by invite who have not created their account yet, that
 * the viewer may put on a plantão (a manager: only of their unit).
 */
export async function listInvitedBrokers(tenantId: string, branchId: string | null) {
  return getDatabase()
    .select({ id: schema.brokerProfiles.id, name: schema.brokerProfiles.professionalName, internalCode: schema.brokerProfiles.internalCode, branchName: schema.branches.name })
    .from(schema.brokerProfiles)
    .leftJoin(schema.branches, eq(schema.branches.id, schema.brokerProfiles.branchId))
    .where(and(
      eq(schema.brokerProfiles.tenantId, tenantId),
      isNull(schema.brokerProfiles.userId),
      inArray(schema.brokerProfiles.lifecycleStatus, ["INVITED", "ONBOARDING"]),
      branchId ? eq(schema.brokerProfiles.branchId, branchId) : undefined,
    ))
    .orderBy(asc(schema.brokerProfiles.professionalName));
}

/**
 * The invite was accepted: each plantão the broker was put on becomes a normal
 * roster row (every occurrence of the plantão, like a weekly row) and leaves
 * the pending list. Runs inside the onboarding transaction.
 */
export async function promotePendingRosterEntries(tx: Tx, input: { tenantId: string; brokerProfileId: string; userId: string; branchId: string }) {
  const pending = await tx
    .select({
      id: schema.dutyRosterPending.id,
      createdBy: schema.dutyRosterPending.createdBy,
      scheduleId: schema.unitDutySchedules.id,
      scheduleBranchId: schema.unitDutySchedules.branchId,
      dayOfWeek: schema.unitDutySchedules.dayOfWeek,
      startsAt: schema.unitDutySchedules.startsAt,
      endsAt: schema.unitDutySchedules.endsAt,
      validFrom: schema.unitDutySchedules.validFrom,
      validUntil: schema.unitDutySchedules.validUntil,
      status: schema.unitDutySchedules.status,
    })
    .from(schema.dutyRosterPending)
    .innerJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.dutyRosterPending.scheduleId), eq(schema.unitDutySchedules.tenantId, input.tenantId)))
    .where(and(eq(schema.dutyRosterPending.tenantId, input.tenantId), eq(schema.dutyRosterPending.brokerProfileId, input.brokerProfileId)));
  const now = new Date();
  let promoted = 0;
  for (const entry of pending) {
    const stillRunning = entry.status === "active" && (!entry.validUntil || entry.validUntil > now);
    // The broker's unit must be the plantão's, or they would receive another unit's leads.
    if (entry.scheduleBranchId && entry.scheduleBranchId !== input.branchId) {
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.userId, entidade: "duty_roster_pending", entidadeId: entry.id, acao: "duty_roster_pending.skipped_other_unit" });
      continue;
    }
    const [existing] = await tx.select({ id: schema.dutyRosterAssignments.id }).from(schema.dutyRosterAssignments)
      .where(and(eq(schema.dutyRosterAssignments.scheduleId, entry.scheduleId), eq(schema.dutyRosterAssignments.brokerId, input.userId), isNull(schema.dutyRosterAssignments.dutyDate), eq(schema.dutyRosterAssignments.status, "active")))
      .limit(1);
    if (stillRunning && !existing) {
      const author = entry.createdBy ?? input.userId;
      await tx.insert(schema.dutyRosterAssignments).values({
        id: randomUUID(), tenantId: input.tenantId, branchId: input.branchId, scheduleId: entry.scheduleId, brokerId: input.userId,
        dayOfWeek: entry.dayOfWeek, startsAt: entry.startsAt, endsAt: entry.endsAt, validFrom: entry.validFrom, validUntil: entry.validUntil,
        status: "active", createdBy: author, updatedBy: author, createdAt: now, updatedAt: now,
      });
      promoted += 1;
    }
  }
  if (pending.length) {
    await tx.delete(schema.dutyRosterPending).where(and(eq(schema.dutyRosterPending.tenantId, input.tenantId), eq(schema.dutyRosterPending.brokerProfileId, input.brokerProfileId)));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.userId, entidade: "duty_roster_pending", entidadeId: input.brokerProfileId, acao: "duty_roster_pending.promoted" });
  }
  promoted += await promotePendingMonthlyAssignments(tx, input, now);
  return promoted;
}

/** Converts published monthly-plan placeholders into exact dated roster rows on invite acceptance. */
async function promotePendingMonthlyAssignments(tx: Tx, input: { tenantId: string; brokerProfileId: string; userId: string; branchId: string }, now: Date) {
  type PendingAssignment = MonthlyPlanAssignment & { rosterAssignmentId?: string };
  type StoredPlan = { id: string; assignments: unknown; occurrences: unknown; settings: unknown; quotas: unknown; publishedBy: string | null };
  await lockMonthlyDutyPlans(tx, input.tenantId);
  const plans = await tx.select({
    id: schema.dutyScheduleMonthlyPlans.id,
    assignments: schema.dutyScheduleMonthlyPlans.assignments,
    occurrences: schema.dutyScheduleMonthlyPlans.occurrences,
    settings: schema.dutyScheduleMonthlyPlans.settings,
    quotas: schema.dutyScheduleMonthlyPlans.quotas,
    publishedBy: schema.dutyScheduleMonthlyPlans.publishedBy,
  }).from(schema.dutyScheduleMonthlyPlans)
    .where(and(eq(schema.dutyScheduleMonthlyPlans.tenantId, input.tenantId), eq(schema.dutyScheduleMonthlyPlans.status, "published"))) as StoredPlan[];
  let promoted = 0;

  for (const plan of plans) {
    const assignments = Array.isArray(plan.assignments) ? plan.assignments as PendingAssignment[] : [];
    const occurrences = Array.isArray(plan.occurrences) ? plan.occurrences as MonthlyPlanOccurrence[] : [];
    const pending = assignments.filter((entry) => entry.brokerId === input.brokerProfileId && entry.origin === "pending");
    if (!pending.length) continue;

    const occurrenceById = new Map(occurrences.map((occurrence) => [occurrence.id, occurrence]));
    const scheduleIds = [...new Set(pending.flatMap((entry) => occurrenceById.get(entry.occurrenceId)?.scheduleId ?? []))];
    const schedules = scheduleIds.length
      ? await tx.select({ id: schema.unitDutySchedules.id, branchId: schema.unitDutySchedules.branchId, status: schema.unitDutySchedules.status, timezone: schema.unitDutySchedules.timezone })
        .from(schema.unitDutySchedules)
        .where(and(eq(schema.unitDutySchedules.tenantId, input.tenantId), inArray(schema.unitDutySchedules.id, scheduleIds)))
      : [];
    const scheduleById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const converted = new Map<string, string>();
    const removed = new Set<string>();

    for (const entry of pending) {
      const occurrence = occurrenceById.get(entry.occurrenceId);
      const schedule = occurrence ? scheduleById.get(occurrence.scheduleId) : null;
      if (!occurrence || !schedule || schedule.status !== "active" || (schedule.branchId && schedule.branchId !== input.branchId) || isMonthlyOccurrenceEnded(occurrence, schedule.timezone, now)) {
        removed.add(entry.occurrenceId);
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(), userId: input.userId, entidade: "duty_schedule_monthly_plan", entidadeId: plan.id,
          acao: "duty_schedule_monthly_plan.pending_broker_skipped",
          metadata: { occurrenceId: entry.occurrenceId, reason: !occurrence ? "occurrence_missing" : !schedule || schedule.status !== "active" ? "schedule_inactive" : schedule.branchId && schedule.branchId !== input.branchId ? "other_unit" : "occurrence_ended" },
        });
        continue;
      }

      const [existing] = await tx.select({ id: schema.dutyRosterAssignments.id, status: schema.dutyRosterAssignments.status })
        .from(schema.dutyRosterAssignments)
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, input.tenantId),
          eq(schema.dutyRosterAssignments.scheduleId, occurrence.scheduleId),
          eq(schema.dutyRosterAssignments.brokerId, input.userId),
          eq(schema.dutyRosterAssignments.dutyDate, occurrence.dutyDate),
        )).limit(1);
      const rosterAssignmentId = existing?.id ?? randomUUID();
      if (existing) {
        await tx.update(schema.dutyRosterAssignments).set({
          branchId: input.branchId, dayOfWeek: dayOfWeekOf(occurrence.dutyDate), startsAt: occurrence.startsAt, endsAt: occurrence.endsAt,
          validFrom: occurrenceValidity(occurrence.dutyDate, schedule.timezone).validFrom,
          validUntil: occurrenceValidity(occurrence.dutyDate, schedule.timezone).validUntil,
          monthlyPlanId: plan.id, status: "active", updatedBy: input.userId, updatedAt: now,
        }).where(eq(schema.dutyRosterAssignments.id, existing.id));
      } else {
        const validity = occurrenceValidity(occurrence.dutyDate, schedule.timezone);
        await tx.insert(schema.dutyRosterAssignments).values({
          id: rosterAssignmentId, tenantId: input.tenantId, branchId: input.branchId, scheduleId: occurrence.scheduleId, brokerId: input.userId,
          dayOfWeek: dayOfWeekOf(occurrence.dutyDate), startsAt: occurrence.startsAt, endsAt: occurrence.endsAt,
          validFrom: validity.validFrom, validUntil: validity.validUntil, dutyDate: occurrence.dutyDate, monthlyPlanId: plan.id,
          status: "active", createdBy: plan.publishedBy ?? input.userId, updatedBy: input.userId, createdAt: now, updatedAt: now,
        });
      }
      converted.set(entry.occurrenceId, rosterAssignmentId);
      promoted += 1;
    }

    const nextAssignments = assignments.flatMap((entry) => {
      if (entry.brokerId !== input.brokerProfileId || entry.origin !== "pending") return [entry];
      const rosterAssignmentId = converted.get(entry.occurrenceId);
      return rosterAssignmentId ? [{ ...entry, brokerId: input.userId, origin: "existing" as const, rosterAssignmentId }] : [];
    });
    const nextOccurrences = occurrences.map((occurrence) => {
      const promotedHere = converted.has(occurrence.id);
      const updateIds = (ids: string[] | undefined) => ids?.flatMap((id) => {
        if (id !== input.brokerProfileId) return [id];
        return promotedHere ? [input.userId] : [];
      });
      return {
        ...occurrence,
        allowedBrokerIds: updateIds(occurrence.allowedBrokerIds) ?? [],
        forcedBrokerIds: updateIds(occurrence.forcedBrokerIds),
        keptBrokerIds: updateIds(occurrence.keptBrokerIds),
      };
    });
    const settings = plan.settings && typeof plan.settings === "object" ? plan.settings as Record<string, unknown> : null;
    const settingBrokers = Array.isArray(settings?.brokers) ? settings.brokers as Array<Record<string, unknown>> : null;
    const nextSettings = settings && settingBrokers
      ? { ...settings, brokers: settingBrokers.flatMap((entry) => entry.brokerId !== input.brokerProfileId ? [entry] : converted.size ? [{ ...entry, brokerId: input.userId }] : []) }
      : plan.settings;
    const quotas = Array.isArray(plan.quotas) ? plan.quotas as Array<Record<string, unknown>> : [];
    const nextQuotas = quotas.flatMap((entry) => entry.brokerId !== input.brokerProfileId ? [entry] : converted.size ? [{ ...entry, brokerId: input.userId }] : []);
    await tx.update(schema.dutyScheduleMonthlyPlans).set({ assignments: nextAssignments, occurrences: nextOccurrences, settings: nextSettings, quotas: nextQuotas, updatedAt: now })
      .where(eq(schema.dutyScheduleMonthlyPlans.id, plan.id));
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: input.userId, entidade: "duty_schedule_monthly_plan", entidadeId: plan.id,
      acao: `duty_schedule_monthly_plan.pending_broker_promoted:${converted.size}:skipped:${removed.size}`,
    });
  }
  return promoted;
}
