import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { zonedMidnight } from "@/features/lead-distribution/monthly-duty-plan";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { buildBrokerDutyCalendar } from "./duty-calendar";

function configuredMonthHorizon(value: string) {
  const allowed = FEATURE_FLAGS.BROKER_DUTY_CALENDAR_HORIZON_MONTHS.allowedValues;
  return allowed.includes(value as (typeof allowed)[number]) ? Number(value) : Number(FEATURE_FLAGS.BROKER_DUTY_CALENDAR_HORIZON_MONTHS.defaultValue);
}

/**
 * Personal schedule calendar. Tenant and broker scope always come from the
 * authenticated request; the only input is the current server clock.
 */
export async function getBrokerDutyCalendarData(now = new Date()) {
  const context = await getRequiredTenantContext();
  if (context.role !== "broker") throw new Error("A agenda de plantões é exclusiva para corretores.");

  const [calendarEnabled, horizonValue, monthlySchedulingValue] = await Promise.all([
    getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR),
    getFeatureFlag(FEATURE_FLAGS.BROKER_DUTY_CALENDAR_HORIZON_MONTHS),
    getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING),
  ]);
  if (calendarEnabled !== "true") throw new Error("A agenda de plantões está desativada.");

  const monthlySchedulingEnabled = monthlySchedulingValue === "true";
  const horizonMonths = configuredMonthHorizon(horizonValue);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const firstMonthKey = `${todayKey.slice(0, 7)}-01`;
  const [endYear, endMonth] = firstMonthKey.split("-").map(Number);
  const endTotalMonths = endYear * 12 + endMonth - 1 + horizonMonths;
  const endExclusiveKey = `${Math.floor(endTotalMonths / 12)}-${String(endTotalMonths % 12 + 1).padStart(2, "0")}-01`;
  const endExclusiveInstant = zonedMidnight(endExclusiveKey, "America/Sao_Paulo");
  const db = getDatabase();

  const weeklyRows = await db.select({
    assignmentId: schema.dutyRosterAssignments.id,
    scheduleId: schema.dutyRosterAssignments.scheduleId,
    scheduleName: schema.unitDutySchedules.name,
    branchName: schema.branches.name,
    dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
    startsAt: schema.dutyRosterAssignments.startsAt,
    endsAt: schema.dutyRosterAssignments.endsAt,
    timezone: schema.unitDutySchedules.timezone,
    validFrom: schema.dutyRosterAssignments.validFrom,
    validUntil: schema.dutyRosterAssignments.validUntil,
    pausedAt: schema.dutyRosterAssignments.pausedAt,
  })
    .from(schema.dutyRosterAssignments)
    .innerJoin(schema.unitDutySchedules, and(
      eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
      eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
      eq(schema.unitDutySchedules.status, "active"),
    ))
    .leftJoin(schema.branches, and(
      eq(schema.branches.id, schema.unitDutySchedules.branchId),
      eq(schema.branches.tenantId, context.tenantId),
    ))
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
      eq(schema.dutyRosterAssignments.brokerId, context.userId),
      eq(schema.dutyRosterAssignments.status, "active"),
      isNull(schema.dutyRosterAssignments.dutyDate),
      isNull(schema.dutyRosterAssignments.monthlyPlanId),
      lt(schema.dutyRosterAssignments.validFrom, endExclusiveInstant),
      or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now)),
    ))
    .orderBy(asc(schema.dutyRosterAssignments.dayOfWeek), asc(schema.dutyRosterAssignments.startsAt));

  const scheduleIds = [...new Set(weeklyRows.map((row) => row.scheduleId))];
  const [publishedRows, publishedScheduleDates] = monthlySchedulingEnabled
    ? await Promise.all([
      db.select({
        assignmentId: schema.dutyRosterAssignments.id,
        scheduleId: schema.dutyRosterAssignments.scheduleId,
        scheduleName: schema.unitDutySchedules.name,
        branchName: schema.branches.name,
        dutyDate: sql<string>`${schema.dutyRosterAssignments.dutyDate}::text`,
        startsAt: schema.dutyRosterAssignments.startsAt,
        endsAt: schema.dutyRosterAssignments.endsAt,
        timezone: schema.unitDutySchedules.timezone,
        pausedAt: schema.dutyRosterAssignments.pausedAt,
      })
        .from(schema.dutyRosterAssignments)
        .innerJoin(schema.unitDutySchedules, and(
          eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
          eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
          eq(schema.unitDutySchedules.status, "active"),
        ))
        .leftJoin(schema.branches, and(
          eq(schema.branches.id, schema.unitDutySchedules.branchId),
          eq(schema.branches.tenantId, context.tenantId),
        ))
        .where(and(
          eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
          eq(schema.dutyRosterAssignments.brokerId, context.userId),
          eq(schema.dutyRosterAssignments.status, "active"),
          isNotNull(schema.dutyRosterAssignments.dutyDate),
          isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
          gte(schema.dutyRosterAssignments.dutyDate, todayKey),
          lt(schema.dutyRosterAssignments.dutyDate, endExclusiveKey),
        ))
        .orderBy(asc(schema.dutyRosterAssignments.dutyDate), asc(schema.dutyRosterAssignments.startsAt)),
      scheduleIds.length
        ? db.selectDistinct({
          scheduleId: schema.dutyRosterAssignments.scheduleId,
          dutyDate: sql<string>`${schema.dutyRosterAssignments.dutyDate}::text`,
        })
          .from(schema.dutyRosterAssignments)
          .where(and(
            eq(schema.dutyRosterAssignments.tenantId, context.tenantId),
            inArray(schema.dutyRosterAssignments.scheduleId, scheduleIds),
            eq(schema.dutyRosterAssignments.status, "active"),
            isNotNull(schema.dutyRosterAssignments.dutyDate),
            isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
            gte(schema.dutyRosterAssignments.dutyDate, todayKey),
            lt(schema.dutyRosterAssignments.dutyDate, endExclusiveKey),
          ))
        : Promise.resolve([] as { scheduleId: string; dutyDate: string }[]),
    ])
    : [[], []] as const;

  const calendar = buildBrokerDutyCalendar({
    now,
    horizonMonths,
    weeklyAssignments: weeklyRows,
    publishedAssignments: publishedRows,
    publishedScheduleDates,
    monthlySchedulingEnabled,
  });

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "broker_duty_calendar",
    entidadeId: context.userId,
    acao: `broker.duty_calendar.viewed:${calendar.firstMonthKey}:${calendar.monthCount}`,
    createdAt: now,
  });

  return calendar;
}
