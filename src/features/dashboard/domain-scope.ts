import { and, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { ReportDataScope } from "@/features/reports/metrics/metric-scope";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

export type DomainDashboardScopes = {
  leads: SQL;
  tasks: SQL;
  conversations: SQL;
  sales: SQL;
  memberships: SQL;
};

/**
 * Applies each role's maximum boundary, intersected with effective report
 * scope. Child records are scoped through their lead so tenant and owner/unit
 * boundaries cannot diverge between dashboard cards.
 */
export function buildDomainDashboardScopes(
  context: TenantContext,
  reportScope: Pick<ReportDataScope, "leadScope" | "salesBrokerScope">,
): DomainDashboardScopes {
  const leadConditions: SQL[] = [eq(schema.leads.tenantId, context.tenantId)];

  if (context.role === "director") {
    if (reportScope.leadScope) leadConditions.push(reportScope.leadScope);
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

  const leads = and(...leadConditions)!;
  const membershipConditions: SQL[] = [eq(schema.tenantMemberships.tenantId, context.tenantId)];
  if (context.customRoleScope === "none") membershipConditions.push(sql`false`);
  if (context.role === "manager") {
    membershipConditions.push(context.branchId
      ? eq(schema.tenantMemberships.branchId, context.branchId)
      : sql`false`);
  } else if (context.role === "supervisor") {
    membershipConditions.push(eq(schema.tenantMemberships.supervisorId, context.userId));
    membershipConditions.push(eq(schema.tenantMemberships.status, "active"));
  } else if (context.role === "broker") {
    membershipConditions.push(eq(schema.tenantMemberships.userId, context.userId));
  } else if (context.role !== "director") {
    membershipConditions.push(sql`false`);
  }

  const scopeChildRows = context.role !== "director" || Boolean(reportScope.leadScope);
  const childLeadCondition = (leadId: AnyColumn | SQL) => sql`${leadId} in (
    select ${schema.leads.id} from ${schema.leads} where ${leads}
  )`;
  const taskConditions: SQL[] = [eq(schema.leadTasks.tenantId, context.tenantId)];
  const conversationConditions: SQL[] = [eq(schema.whatsappMessages.tenantId, context.tenantId)];
  if (scopeChildRows) {
    taskConditions.push(childLeadCondition(schema.leadTasks.leadId));
    conversationConditions.push(childLeadCondition(schema.whatsappMessages.leadId));
  }

  const salesConditions: SQL[] = [eq(schema.sales.tenantId, context.tenantId)];
  if (reportScope.salesBrokerScope) salesConditions.push(reportScope.salesBrokerScope);
  if (scopeChildRows) salesConditions.push(childLeadCondition(schema.sales.leadId));

  return {
    leads,
    tasks: and(...taskConditions)!,
    conversations: and(...conversationConditions)!,
    sales: and(...salesConditions)!,
    memberships: and(...membershipConditions)!,
  };
}
