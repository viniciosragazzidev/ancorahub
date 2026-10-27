import "server-only";

import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import { resolveEventMessagePlan } from "@/features/communication-channels/message-policy-service";
import { enqueueMetaTextMessage } from "@/features/communication-channels/outbound-service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { companyNumberUsable } from "@/features/team-notices/decision";
import { getCompanyNumberState } from "@/features/team-notices/service";

import { getDutyReminderDateKey, dutyShiftReminderIdempotencyKey, formatDutyShiftReminderVariables, selectDueDutyShiftReminders, type DutyReminderAssignment, type DutyReminderSchedule } from "./duty-shift-reminder-domain";

const TENANT_FLAG_PREFIX = `${FEATURE_FLAGS.DUTY_SHIFT_REMINDER_24H.key}_`;
const TENANT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function nextDateWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function tenantIdsFromSettings(keys: readonly string[]) {
  return [...new Set(keys.flatMap((key) => {
    if (!key.startsWith(TENANT_FLAG_PREFIX)) return [];
    const tenantId = key.slice(TENANT_FLAG_PREFIX.length);
    return TENANT_ID_PATTERN.test(tenantId) ? [tenantId] : [];
  }))];
}

/** Sweep attached to the existing distribution job. It never falls back to Meta. */
export async function processDutyShiftReminders(now = new Date()) {
  const db = getDatabase();
  const enabledSettings = await db.select({ key: schema.systemSettings.key }).from(schema.systemSettings)
    .where(and(sql`left(${schema.systemSettings.key}, ${TENANT_FLAG_PREFIX.length}) = ${TENANT_FLAG_PREFIX}`, eq(schema.systemSettings.value, "true")));
  const tenantIds = tenantIdsFromSettings(enabledSettings.map((row) => row.key));
  if (!tenantIds.length) return { enabled: false, considered: 0, queued: 0, failed: 0, duplicates: 0 };

  const schedules = await db.select({
    id: schema.unitDutySchedules.id,
    tenantId: schema.unitDutySchedules.tenantId,
    name: schema.unitDutySchedules.name,
    dayOfWeek: schema.unitDutySchedules.dayOfWeek,
    startsAt: schema.unitDutySchedules.startsAt,
    endsAt: schema.unitDutySchedules.endsAt,
    timezone: schema.unitDutySchedules.timezone,
    attendanceMode: schema.unitDutySchedules.attendanceMode,
    validFrom: schema.unitDutySchedules.validFrom,
    validUntil: schema.unitDutySchedules.validUntil,
    status: schema.unitDutySchedules.status,
  }).from(schema.unitDutySchedules)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.unitDutySchedules.tenantId))
    .where(and(inArray(schema.unitDutySchedules.tenantId, tenantIds), eq(schema.unitDutySchedules.status, "active"), eq(schema.tenants.status, "active")));
  if (!schedules.length) return { enabled: true, considered: 0, queued: 0, failed: 0, duplicates: 0 };

  const scheduleDateById = new Map(schedules.map((schedule) => [schedule.id, getDutyReminderDateKey(now, schedule.timezone)]));
  const dutyDates = [...new Set(scheduleDateById.values())];
  const weekdays = [...new Set(dutyDates.map(nextDateWeekday))];
  const scheduleIds = schedules.map((schedule) => schedule.id);
  const assignmentRows = await db.select({
    id: schema.dutyRosterAssignments.id,
    tenantId: schema.dutyRosterAssignments.tenantId,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    brokerId: schema.dutyRosterAssignments.brokerId,
    brokerName: schema.user.name,
    phone: sql<string | null>`(select bp.phone from broker_profiles bp where bp.tenant_id = ${schema.dutyRosterAssignments.tenantId} and bp.user_id = ${schema.dutyRosterAssignments.brokerId} order by bp.created_at desc limit 1)`,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
    dutyDate: schema.dutyRosterAssignments.dutyDate,
    monthlyPlanId: schema.dutyRosterAssignments.monthlyPlanId,
    pausedAt: schema.dutyRosterAssignments.pausedAt,
    attendanceMode: schema.dutyRosterAssignments.attendanceMode,
    branchName: schema.branches.name,
    status: schema.dutyRosterAssignments.status,
  }).from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .innerJoin(schema.user, eq(schema.user.id, schema.dutyRosterAssignments.brokerId))
    .innerJoin(schema.tenantMemberships, and(
      eq(schema.tenantMemberships.userId, schema.dutyRosterAssignments.brokerId),
      eq(schema.tenantMemberships.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .leftJoin(schema.branches, and(
      eq(schema.branches.id, schema.dutyRosterAssignments.branchId),
      eq(schema.branches.tenantId, schema.dutyRosterAssignments.tenantId),
    ))
    .where(and(
      inArray(schema.dutyRosterAssignments.tenantId, tenantIds),
      inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds),
      eq(schema.dutyRosterAssignments.status, "active"),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.user.active, true),
      eq(schema.user.status, "active"),
      or(
        and(isNull(schema.dutyRosterAssignments.dutyDate), inArray(schema.dutyRosterAssignments.dayOfWeek, weekdays)),
        and(isNotNull(schema.dutyRosterAssignments.dutyDate), inArray(schema.dutyRosterAssignments.dutyDate, dutyDates)),
      ),
    ));

  const publishedScheduleIdsByTenantDate = new Map<string, Set<string> | null>();
  const monthlyEnabled = (await getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING).catch(() => "false")) === "true";
  for (const schedule of schedules) {
    const key = `${schedule.tenantId}:${scheduleDateById.get(schedule.id)}`;
    publishedScheduleIdsByTenantDate.set(key, monthlyEnabled ? new Set() : null);
  }
  if (monthlyEnabled && dutyDates.length) {
    const publishedRows = await db.select({
      tenantId: schema.dutyRosterAssignments.tenantId,
      dutyDate: schema.dutyRosterAssignments.dutyDate,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
    }).from(schema.dutyRosterAssignments).where(and(
      inArray(schema.dutyRosterAssignments.tenantId, tenantIds),
      inArray(schema.dutyRosterAssignments.dutyDate, dutyDates),
      eq(schema.dutyRosterAssignments.status, "active"),
      isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
    ));
    for (const row of publishedRows) {
      if (!row.dutyDate) continue;
      const set = publishedScheduleIdsByTenantDate.get(`${row.tenantId}:${row.dutyDate}`);
      set?.add(row.scheduleId);
    }
  }

  const due = selectDueDutyShiftReminders({
    schedules: schedules as DutyReminderSchedule[],
    assignments: assignmentRows.map((row) => ({ ...row, phone: row.phone ?? null, hasAccount: true })) as DutyReminderAssignment[],
    publishedScheduleIdsByTenantDate,
    now,
  });
  const dueKeys = due.map((candidate) => dutyShiftReminderIdempotencyKey(candidate));
  const existingRows = dueKeys.length ? await db.select({
    tenantId: schema.whatsappOutboundMessages.tenantId,
    idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey,
    status: schema.whatsappOutboundMessages.status,
    providerErrorCode: schema.whatsappOutboundMessages.providerErrorCode,
  }).from(schema.whatsappOutboundMessages).where(and(
    inArray(schema.whatsappOutboundMessages.tenantId, tenantIds),
    inArray(schema.whatsappOutboundMessages.idempotencyKey, dueKeys),
  )) : [];
  const existingByKey = new Map(existingRows.map((row) => [`${row.tenantId}:${row.idempotencyKey}`, row]));
  const tenantsToCheck = [...new Set(due.flatMap((candidate) => {
    const existing = existingByKey.get(`${candidate.assignment.tenantId}:${dutyShiftReminderIdempotencyKey(candidate)}`);
    return existing?.status === "failed" && existing.providerErrorCode === "COMPANY_NUMBER_UNAVAILABLE" ? [candidate.assignment.tenantId] : [];
  }))];
  const usableCompanies = new Map(await Promise.all(tenantsToCheck.map(async (tenantId) => {
    const state = await getCompanyNumberState(tenantId).catch(() => null);
    return [tenantId, companyNumberUsable(state, now).usable] as const;
  })));
  const work = due.filter((candidate) => {
    const existing = existingByKey.get(`${candidate.assignment.tenantId}:${dutyShiftReminderIdempotencyKey(candidate)}`);
    if (!existing) return true;
    if (existing.status !== "failed") return false;
    if (existing.providerErrorCode === "BROKER_PHONE_UNAVAILABLE") return Boolean(candidate.assignment.phone?.trim());
    if (existing.providerErrorCode === "COMPANY_NUMBER_UNAVAILABLE") return Boolean(candidate.assignment.phone?.trim() && usableCompanies.get(candidate.assignment.tenantId));
    return false;
  });
  let queued = 0;
  let failed = 0;
  let duplicates = due.length - work.length;
  for (const candidate of work) {
    try {
      const variables = formatDutyShiftReminderVariables(candidate);
      const plan = await resolveEventMessagePlan({
        tenantId: candidate.assignment.tenantId,
        recipientType: "user",
        recipientId: candidate.assignment.brokerId,
        destinationPhone: candidate.assignment.phone ?? "",
        purpose: "dutyShiftReminder",
        variables,
        forceCompanyFreeText: true,
      });
      if (!plan) throw new Error("DUTY_SHIFT_REMINDER_TEXT_UNAVAILABLE");
      const body = plan.primary.type === "text" ? plan.primary.renderedBody : null;
      if (!body) throw new Error("DUTY_SHIFT_REMINDER_TEXT_UNAVAILABLE");
      const result = await enqueueMetaTextMessage({
        tenantId: candidate.assignment.tenantId,
        recipientType: "user",
        recipientId: candidate.assignment.brokerId,
        destinationPhone: candidate.assignment.phone ?? "",
        body,
        purpose: "dutyShiftReminder",
        forceCompanyWahaOnly: true,
        messagePolicyId: plan.policyId,
        messagePolicyVersion: plan.policyVersion,
        dutyDate: candidate.window.dutyDate,
        idempotencyKey: dutyShiftReminderIdempotencyKey(candidate),
      });
      if (result.duplicate) duplicates += 1;
      if (result.status === "failed") failed += 1;
      else if (result.status === "queued" && !result.duplicate) queued += 1;
    } catch (error) {
      failed += 1;
      console.error("[duty-shift-reminder] enqueue failed", {
        tenantId: candidate.assignment.tenantId,
        assignmentId: candidate.assignment.id,
        code: error instanceof Error ? error.message.slice(0, 80) : "UNKNOWN_ERROR",
      });
    }
  }
  return { enabled: true, considered: due.length, queued, failed, duplicates };
}
