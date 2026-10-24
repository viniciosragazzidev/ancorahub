import { operationDayStart } from "@/features/reports/metrics/lead-quality-period";
import type { TenantContext } from "@/shared/auth/types";

/**
 * Filters of the dashboard's "Visão da operação": a period (the operation day,
 * 7 or 30 operation days) and, for the Diretor, one unit. Pure helpers only, so
 * the window and the branch rules are unit-tested without a database.
 */
export const OVERVIEW_PERIODS = ["today", "7d", "30d"] as const;
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export type OverviewFilter = {
  period?: OverviewPeriod;
  /** Only honoured for the Diretor; other roles keep the scope of their session. */
  branchId?: string | null;
};

/** The window and unit the numbers were counted in, for the screen to label. */
export type OverviewWindow = {
  period: OverviewPeriod;
  /** ISO instant, inclusive. */
  start: string;
  /** ISO instant the counts run up to (the request time). */
  end: string;
  /** Unit the numbers are narrowed to; null = the viewer's whole scope. */
  branchId: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const OPERATION_DAYS: Record<OverviewPeriod, number> = { today: 1, "7d": 7, "30d": 30 };

export function isOverviewPeriod(value: unknown): value is OverviewPeriod {
  return typeof value === "string" && (OVERVIEW_PERIODS as readonly string[]).includes(value);
}

/** Validates `?periodo=` style input; anything unknown falls back to today. */
export function parseOverviewPeriod(raw: unknown): OverviewPeriod {
  if (raw === "hoje") return "today";
  if (raw === "7") return "7d";
  if (raw === "30") return "30d";
  return isOverviewPeriod(raw) ? raw : "today";
}

/**
 * Window of a period. "today" is the operation day (since 19:00 São Paulo, the
 * same turn as "Chegaram no turno" and Qualidade dos leads "Hoje"); 7d and 30d
 * are 7 and 30 operation days counted back from the start of today's, today's
 * included (like `periodStart`: N days with today as the last one).
 */
export function overviewWindowBounds(period: OverviewPeriod = "today", now = new Date()) {
  const todayStart = operationDayStart(now);
  const back = OPERATION_DAYS[period] - 1;
  // Land a couple of hours into that day's turn and snap to its 19:00, so a
  // future DST change in the zone would still start the window at 19:00.
  const start = back === 0 ? todayStart : operationDayStart(new Date(todayStart.getTime() - back * DAY_MS + 2 * 60 * 60 * 1000));
  return { start, end: now };
}

export type OverviewBranchScope = {
  /** Unit the screen shows; null = the whole scope of the viewer. */
  branchId: string | null;
  /**
   * "request": a Diretor chose a unit, the queries add the unit filter (after
   * checking it belongs to the tenant). "session": the unit comes from the
   * session (Gestor), already enforced by the report scope. "none": no unit.
   */
  source: "request" | "session" | "none";
};

/**
 * Which unit the overview may be narrowed to. Only a Diretor who sees the whole
 * company can pick one; a Gestor always sees their own unit whatever is asked;
 * Supervisor (team) and the other roles keep their current scope.
 */
export function resolveOverviewBranch(input: {
  role: TenantContext["role"];
  sessionBranchId: string | null;
  /** `ReportDataScope.canCompareUnits`: Diretor with tenant-wide data. */
  canCompareUnits: boolean;
  requestedBranchId?: string | null;
}): OverviewBranchScope {
  if (input.role === "director") {
    const requested = input.requestedBranchId?.trim();
    return input.canCompareUnits && requested ? { branchId: requested, source: "request" } : { branchId: null, source: "none" };
  }
  if (input.role === "manager") {
    return input.sessionBranchId ? { branchId: input.sessionBranchId, source: "session" } : { branchId: null, source: "none" };
  }
  return { branchId: null, source: "none" };
}
