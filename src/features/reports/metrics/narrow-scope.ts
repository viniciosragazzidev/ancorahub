import { and, eq } from "drizzle-orm";

import { schema } from "@/shared/db";

import type { ReportDataScope } from "./metric-scope";

/**
 * The report scope narrowed to one unit: the unit is added to the lead filter
 * (an AND), so it can only shrink what the session already allows, never widen
 * it. Without a unit the scope is returned as is. The caller resolves which
 * unit a role may pick (see `resolveOverviewFilter` on the dashboard).
 */
export function narrowReportScopeToBranch<T extends Pick<ReportDataScope, "leadScope">>(scope: T, branchId?: string | null): T {
  if (!branchId) return scope;
  return { ...scope, leadScope: and(scope.leadScope, eq(schema.leads.branchId, branchId)) };
}
