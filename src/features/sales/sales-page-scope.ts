import { and, eq, sql, type SQL } from "drizzle-orm";

import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { ReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

export function buildSalesPageScope(
  context: TenantContext,
  reportScope: Pick<ReportDataScope, "leadScope" | "salesBrokerScope">,
  requestedBranchId?: string,
): { salesWhere: SQL; branchesWhere: SQL | undefined } {
  const leadConditions: SQL[] = [eq(schema.leads.tenantId, context.tenantId)];

  if (context.role === "director") {
    if (reportScope.leadScope) leadConditions.push(reportScope.leadScope);
    if (requestedBranchId) leadConditions.push(eq(schema.leads.branchId, requestedBranchId));
  } else if (context.role === "manager") {
    leadConditions.push(context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : sql`false`);
    if (reportScope.leadScope) leadConditions.push(reportScope.leadScope);
  } else if (context.role === "supervisor") {
    leadConditions.push(inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId));
    if (reportScope.leadScope) leadConditions.push(reportScope.leadScope);
  } else if (context.role === "broker") {
    leadConditions.push(eq(schema.leads.corretorId, context.userId));
    if (reportScope.leadScope) leadConditions.push(reportScope.leadScope);
  } else {
    leadConditions.push(sql`false`);
  }

  const salesConditions: SQL[] = [
    eq(schema.sales.tenantId, context.tenantId),
    ...leadConditions,
  ];
  if (reportScope.salesBrokerScope) salesConditions.push(reportScope.salesBrokerScope);

  let branchesWhere: SQL | undefined;
  if (context.role === "director") {
    branchesWhere = eq(schema.branches.tenantId, context.tenantId);
  } else if (context.role === "manager") {
    branchesWhere = and(
      eq(schema.branches.tenantId, context.tenantId),
      context.branchId ? eq(schema.branches.id, context.branchId) : sql`false`,
    );
  }

  return { salesWhere: and(...salesConditions)!, branchesWhere };
}
