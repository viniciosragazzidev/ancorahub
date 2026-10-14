import "server-only";

import { and, eq, sql, type SQL } from "drizzle-orm";

import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

export async function canViewIntegrityPanel(context: TenantContext) {
  return hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "ver_painel_integridade",
  });
}

/** Tenant-bound audit feed. Legacy audit rows have no tenant_id, so attribute a
 * row only when its actor had an active membership in this tenant at that time.
 */
export function buildIntegrityAuditScope(context: TenantContext): SQL {
  return sql`${schema.auditLogs.userId} in (
    select ${schema.tenantMemberships.userId}
    from ${schema.tenantMemberships}
    where ${schema.tenantMemberships.tenantId} = ${context.tenantId}
      and ${schema.tenantMemberships.status} = 'active'
      and ${schema.tenantMemberships.updatedAt} <= ${schema.auditLogs.createdAt}
  )`;
}

/**
 * Adds the role's hard boundary on top of the effective report scope. A
 * custom role may narrow the result, but cannot widen a manager to another
 * unit or a supervisor to the rest of the tenant.
 */
export async function buildIntegrityLeadScope(context: TenantContext): Promise<SQL> {
  const reportScope = await resolveReportDataScope(context);
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
  } else {
    conditions.push(sql`false`);
  }

  return and(...conditions)!;
}
