import { and, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { ReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

/** Role maximums intersected with custom/report scope. Caller still applies resource tenant filters. */
export function buildStrictRoleLeadScope(
  context: TenantContext,
  reportScope: Pick<ReportDataScope, "leadScope">,
): SQL {
  const conditions: SQL[] = [eq(schema.leads.tenantId, context.tenantId)];

  if (context.role === "director") {
    if (reportScope.leadScope) conditions.push(reportScope.leadScope);
  } else if (context.role === "manager") {
    conditions.push(context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : sql`false`);
    if (reportScope.leadScope) conditions.push(reportScope.leadScope);
  } else if (context.role === "supervisor") {
    conditions.push(inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId));
    if (reportScope.leadScope) conditions.push(reportScope.leadScope);
  } else if (context.role === "broker") {
    conditions.push(eq(schema.leads.corretorId, context.userId));
    if (reportScope.leadScope) conditions.push(reportScope.leadScope);
  } else {
    conditions.push(sql`false`);
  }

  return and(...conditions)!;
}

export function leadIdInStrictRoleScope(leadId: AnyColumn | SQL, scope: SQL): SQL {
  return sql`${leadId} in (select ${schema.leads.id} from ${schema.leads} where ${scope})`;
}
