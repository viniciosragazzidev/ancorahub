import { and, eq, isNotNull } from "drizzle-orm";

import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

type DutyRosterRow = { scheduleId: string; dutyDate: string | null };

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getSaoPauloDateKey(date: Date) {
  return dateKey(date);
}

/**
 * Roster rows in force on `today` (DEC-123).
 * - `publishedScheduleIds` null (monthly scheduling off): weekly rows only;
 *   published rows never leak into distribution.
 * - Otherwise a plantão with published brokers today uses exactly those
 *   (in every unit, it is one global occurrence) and ignores its weekly rows;
 *   every other plantão keeps its weekly roster.
 */
export function selectEffectiveDutyAssignments<T extends DutyRosterRow>(
  rows: readonly T[],
  today: string,
  publishedScheduleIds: ReadonlySet<string> | null,
): T[] {
  if (!publishedScheduleIds) return rows.filter((row) => row.dutyDate === null);
  return rows.filter((row) => row.dutyDate === null
    ? !publishedScheduleIds.has(row.scheduleId)
    : row.dutyDate === today && publishedScheduleIds.has(row.scheduleId));
}

/**
 * Plantões that have at least one published broker today, across all units.
 * Null when monthly scheduling is disabled. A published occurrence left with no
 * broker keeps the weekly roster instead of stalling distribution.
 */
export async function getPublishedDutyScheduleIds(tenantId: string, today: string): Promise<Set<string> | null> {
  if ((await getFeatureFlag(FEATURE_FLAGS.DUTY_MONTHLY_SCHEDULING)) !== "true") return null;
  const rows = await getDatabase()
    .selectDistinct({ scheduleId: schema.dutyRosterAssignments.scheduleId })
    .from(schema.dutyRosterAssignments)
    .where(and(
      eq(schema.dutyRosterAssignments.tenantId, tenantId),
      eq(schema.dutyRosterAssignments.dutyDate, today),
      eq(schema.dutyRosterAssignments.status, "active"),
      isNotNull(schema.dutyRosterAssignments.monthlyPlanId),
    ));
  return new Set(rows.map((row) => row.scheduleId));
}

/** Convenience for resolvers: filter rows loaded for `now` to the ones in force. */
export async function resolveEffectiveDutyAssignments<T extends DutyRosterRow>(
  tenantId: string,
  rows: readonly T[],
  now: Date,
  options?: { dutyDate?: string; publishedScheduleIds?: ReadonlySet<string> | null },
): Promise<T[]> {
  const today = options?.dutyDate ?? dateKey(now);
  const publishedScheduleIds = options && "publishedScheduleIds" in options
    ? options.publishedScheduleIds ?? null
    : await getPublishedDutyScheduleIds(tenantId, today);
  return selectEffectiveDutyAssignments(rows, today, publishedScheduleIds);
}
