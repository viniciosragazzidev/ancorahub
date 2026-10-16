import "server-only";

import { and, asc, eq, gte, gt, isNotNull, lt, lte, or, sql, isNull } from "drizzle-orm";

import { getDutyWindowOnDate } from "@/features/lead-distribution/duty-presence-domain";
import { getSaoPauloDateKey, resolveEffectiveDutyAssignments } from "@/features/lead-distribution/dated-duty-roster";
import { getDatabase, schema } from "@/shared/db";
import { isBrokerReadyToReceive } from "./workspace-data-domain";
import type { BrokerActiveDuty, DutyPresenceAsk } from "./queries";

/**
 * The roster rows and the published plantões that the broker's duty is built from. Dates from
 * `fromDateKey` (São Paulo) to the eighth day after today; the broker home starts at today, the
 * plantão view starts at yesterday so a night shift that began yesterday is still running.
 */
export async function loadBrokerDutyRows(input: { tenantId: string; brokerId: string; now: Date; fromDateKey: string }) {
  const { tenantId, brokerId, now, fromDateKey } = input;
  const db = getDatabase();
  const todayKey = getSaoPauloDateKey(now);
  const endExclusiveDutyDate = addCalendarDays(todayKey, 8);
  const dutyHorizonEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  const [rows, publishedRows] = await Promise.all([
    db.select({
      assignmentId: schema.dutyRosterAssignments.id,
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      scheduleName: schema.unitDutySchedules.name,
      queueName: schema.leadQueues.name,
      branchName: schema.branches.name,
      dayOfWeek: schema.dutyRosterAssignments.dayOfWeek,
      startsAt: schema.dutyRosterAssignments.startsAt,
      endsAt: schema.dutyRosterAssignments.endsAt,
      timezone: schema.unitDutySchedules.timezone,
      validFrom: schema.dutyRosterAssignments.validFrom,
      validUntil: schema.dutyRosterAssignments.validUntil,
      pausedAt: schema.dutyRosterAssignments.pausedAt,
      dutyDate: sql<string | null>`${schema.dutyRosterAssignments.dutyDate}::text`,
      monthlyPlanId: schema.dutyRosterAssignments.monthlyPlanId,
      attendanceMode: schema.unitDutySchedules.attendanceMode,
      confirmationStatus: schema.dutyPresenceConfirmations.status,
      confirmedBy: schema.dutyPresenceConfirmations.confirmedBy,
      confirmationId: schema.dutyPresenceConfirmations.id,
      hasPhoto: sql<boolean>`${schema.dutyPresenceConfirmations.photoStorageKey} is not null`,
    })
      .from(schema.dutyRosterAssignments)
      .innerJoin(schema.unitDutySchedules, and(
        eq(schema.unitDutySchedules.id, schema.dutyRosterAssignments.scheduleId),
        eq(schema.unitDutySchedules.tenantId, schema.dutyRosterAssignments.tenantId),
        eq(schema.unitDutySchedules.status, "active"),
      ))
      .leftJoin(schema.leadQueues, and(
        eq(schema.leadQueues.id, schema.unitDutySchedules.queueId),
        eq(schema.leadQueues.tenantId, tenantId),
      ))
      .leftJoin(schema.branches, and(
        eq(schema.branches.id, schema.unitDutySchedules.branchId),
        eq(schema.branches.tenantId, tenantId),
      ))
      .leftJoin(schema.dutyPresenceConfirmations, and(
        eq(schema.dutyPresenceConfirmations.assignmentId, schema.dutyRosterAssignments.id),
        eq(schema.dutyPresenceConfirmations.tenantId, tenantId),
        // Includes the shift starting within 30 min (it can already be confirmed).
        lte(schema.dutyPresenceConfirmations.shiftStartsAt, new Date(now.getTime() + 30 * 60_000)),
        gt(schema.dutyPresenceConfirmations.shiftEndsAt, now),
      ))
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, tenantId),
        eq(schema.dutyRosterAssignments.brokerId, brokerId),
        eq(schema.dutyRosterAssignments.status, "active"),
        or(
          and(isNull(schema.dutyRosterAssignments.dutyDate), isNull(schema.dutyRosterAssignments.monthlyPlanId)),
          and(isNotNull(schema.dutyRosterAssignments.dutyDate), gte(schema.dutyRosterAssignments.dutyDate, fromDateKey), lt(schema.dutyRosterAssignments.dutyDate, endExclusiveDutyDate)),
        ),
        lt(schema.dutyRosterAssignments.validFrom, dutyHorizonEnd),
        or(isNull(schema.dutyRosterAssignments.validUntil), gt(schema.dutyRosterAssignments.validUntil, now)),
      ))
      .orderBy(asc(schema.dutyRosterAssignments.dutyDate), asc(schema.dutyRosterAssignments.dayOfWeek), asc(schema.dutyRosterAssignments.startsAt)),

    db.selectDistinct({
      scheduleId: schema.dutyRosterAssignments.scheduleId,
      dutyDate: sql<string>`${schema.dutyRosterAssignments.dutyDate}::text`,
    })
      .from(schema.dutyRosterAssignments)
      .where(and(
        eq(schema.dutyRosterAssignments.tenantId, tenantId),
        eq(schema.dutyRosterAssignments.status, "active"),
        isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
        gte(schema.dutyRosterAssignments.dutyDate, fromDateKey),
        lt(schema.dutyRosterAssignments.dutyDate, endExclusiveDutyDate),
      )),

  ]);
  return { rows, publishedRows };
}
export function addCalendarDays(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}

export function weekdayForDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function buildDutySummary(input: {
  tenantId: string;
  rows: Array<{
    assignmentId: string;
    scheduleId: string;
    scheduleName: string;
    queueName: string | null;
    branchName: string | null;
    dayOfWeek: number;
    startsAt: string;
    endsAt: string;
    timezone: string;
    validFrom: Date;
    validUntil: Date | null;
    pausedAt: Date | null;
    dutyDate: string | null;
    monthlyPlanId: string | null;
    attendanceMode: string;
    confirmationStatus: string | null;
    confirmedBy: string | null;
    confirmationId?: string | null;
    hasPhoto?: boolean | null;
  }>;
  publishedRows: Array<{ scheduleId: string; dutyDate: string }>;
  now: Date;
  monthlySchedulingEnabled: boolean;
  presenceRequired: boolean;
  availabilityStatus: "available" | "paused" | "offline";
  /** Days from today to read (0 = today). The broker home reads today and the next seven days. */
  dayOffsets?: number[];
}) {
  const today = getSaoPauloDateKey(input.now);
  const dates = (input.dayOffsets ?? Array.from({ length: 8 }, (_, offset) => offset)).map((offset) => addCalendarDays(today, offset));
  const publishedByDate = new Map<string, Set<string>>();
  if (input.monthlySchedulingEnabled) {
    for (const row of input.publishedRows) {
      const scheduleIds = publishedByDate.get(row.dutyDate) ?? new Set<string>();
      scheduleIds.add(row.scheduleId);
      publishedByDate.set(row.dutyDate, scheduleIds);
    }
  }

  const occurrences = dates.flatMap((dutyDate) => {
    const publishedScheduleIds = input.monthlySchedulingEnabled ? publishedByDate.get(dutyDate) ?? new Set<string>() : null;
    return resolveEffectiveDutyAssignments(input.tenantId, input.rows, input.now, { dutyDate, publishedScheduleIds })
      .then((effectiveRows) => effectiveRows.flatMap((row) => {
        const weekday = row.dutyDate ? weekdayForDate(dutyDate) : row.dayOfWeek;
        const window = getDutyWindowOnDate({ dayOfWeek: weekday, startsAt: row.startsAt, endsAt: row.endsAt, timezone: row.timezone }, dutyDate);
        if (!window || window.startsAt < row.validFrom || (row.validUntil && window.startsAt >= row.validUntil)) return [];
        return [{ row, ...window }];
      }));
  });

  return Promise.all(occurrences).then((resolved) => {
    const allOccurrences = resolved.flat();
    const activeOccurrences = allOccurrences
      .filter((occurrence) => occurrence.startsAt <= input.now && input.now < occurrence.endsAt)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime() || left.row.scheduleId.localeCompare(right.row.scheduleId));
    const activeOccurrence = activeOccurrences[0];
    const nextOccurrence = allOccurrences
      .filter((occurrence) => occurrence.startsAt > input.now)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime() || left.row.scheduleId.localeCompare(right.row.scheduleId))[0];

    if (!activeOccurrence && !nextOccurrence) return null;

    type Occurrence = (typeof allOccurrences)[number];
    const presenceStatusOf = (occurrence: Occurrence) =>
      occurrence.row.confirmationStatus === "confirmed" && (occurrence.row.attendanceMode !== "presencial" || Boolean(occurrence.row.confirmedBy))
        ? "confirmed" as const
        : occurrence.row.attendanceMode === "presencial" || input.presenceRequired
          ? "pending" as const
          : "not_required" as const;
    // To confirm: a shift in progress, or one starting within 30 minutes. With two
    // at once (PME online + Presencial), the one still waiting for confirmation
    // comes first: asking the already confirmed PME hid the Presencial photo.
    const startingSoon = allOccurrences.filter((occurrence) => occurrence.startsAt > input.now && occurrence.startsAt.getTime() - input.now.getTime() <= 30 * 60_000)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
    const presenceCandidates = [...activeOccurrences, ...startingSoon];
    const presenceOccurrence = presenceCandidates.find((occurrence) => presenceStatusOf(occurrence) === "pending") ?? presenceCandidates[0];
    const presenceMode = presenceOccurrence?.row.attendanceMode === "presencial" ? "presencial" as const : "online" as const;
    const presence: DutyPresenceAsk | null = presenceOccurrence && (presenceMode === "presencial" || input.presenceRequired)
      ? {
        assignmentId: presenceOccurrence.row.assignmentId,
        scheduleName: presenceOccurrence.row.scheduleName,
        branchName: presenceOccurrence.row.branchName,
        mode: presenceMode,
        startsAt: presenceOccurrence.startsAt,
        endsAt: presenceOccurrence.endsAt,
        status: presenceOccurrence.row.confirmationStatus === "confirmed" && (presenceMode === "online" || Boolean(presenceOccurrence.row.confirmedBy))
          ? "confirmed"
          : presenceMode === "presencial" && presenceOccurrence.row.hasPhoto ? "awaiting_release" : "pending",
        photoId: presenceOccurrence.row.hasPhoto ? presenceOccurrence.row.confirmationId ?? null : null,
      }
      : null;
    const paused = activeOccurrence ? Boolean(activeOccurrence.row.pausedAt) : false;
    const toActive = (occurrence: Occurrence): BrokerActiveDuty => ({
      scheduleId: occurrence.row.scheduleId,
      scheduleName: occurrence.row.scheduleName,
      queueName: occurrence.row.queueName,
      branchName: occurrence.row.branchName,
      dutyDate: occurrence.dutyDate,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      paused: Boolean(occurrence.row.pausedAt),
      presenceStatus: presenceStatusOf(occurrence),
      attendanceMode: occurrence.row.attendanceMode,
    });
    const active = activeOccurrence ? toActive(activeOccurrence) : null;
    const next = nextOccurrence ? {
      scheduleName: nextOccurrence.row.scheduleName,
      queueName: nextOccurrence.row.queueName,
      dutyDate: nextOccurrence.dutyDate,
      startsAt: nextOccurrence.startsAt,
      endsAt: nextOccurrence.endsAt,
      paused: Boolean(nextOccurrence.row.pausedAt),
    } : null;

    return {
      active,
      activeAll: activeOccurrences.map(toActive),
      next,
      readyToReceive: active ? isBrokerReadyToReceive({ availabilityStatus: input.availabilityStatus, paused, presenceStatus: active.presenceStatus }) : false,
      presence,
    };
  });
}

