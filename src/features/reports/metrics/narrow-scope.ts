import { and, eq, inArray, sql } from "drizzle-orm";

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

/**
 * Brokers of one unit (their membership's unit), to choose WHICH brokers enter
 * "Corretores acima da capacidade" without cutting their load: a broker's
 * active leads still count across the whole tenant.
 */
export function brokersOfBranchCondition(tenantId: string, branchId: string) {
  return inArray(
    schema.leads.corretorId,
    sql`(select ${schema.tenantMemberships.userId} from ${schema.tenantMemberships}
      where ${schema.tenantMemberships.tenantId} = ${tenantId}
        and ${schema.tenantMemberships.branchId} = ${branchId})`,
  );
}

/** Link of an attention item to its drill, keeping the unit picked on the overview. */
export function drilldownHref(id: string, period: number, branchId?: string | null) {
  const params = new URLSearchParams({ period: String(period) });
  if (branchId) params.set("branchId", branchId);
  return `/dashboard/drill/${id}?${params.toString()}`;
}

/** `?branchId=` from the URL: a non-empty id or null (the role rules and the tenant check come after). */
export function parseBranchIdParam(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id && id.length <= 128 ? id : null;
}
