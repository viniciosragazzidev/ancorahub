import { and, eq, sql, type SQL } from "drizzle-orm";

import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

export function buildCompanyLeadCountScope(context: TenantContext): SQL | undefined {
  if (context.role === "director") return undefined;
  if (context.role === "manager") {
    return context.branchId ? eq(schema.leads.branchId, context.branchId) : sql`false`;
  }
  if (context.role === "supervisor") {
    return inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId);
  }
  if (context.role === "broker") return eq(schema.leads.corretorId, context.userId);
  return sql`false`;
}

export function buildCompanyReadScope(context: TenantContext): SQL {
  const tenant = eq(schema.companies.tenantId, context.tenantId);
  if (context.role === "director") return tenant;
  if (context.role === "manager") {
    return and(tenant, context.branchId ? eq(schema.companies.branchId, context.branchId) : sql`false`)!;
  }
  const leadScope = buildCompanyLeadCountScope(context);
  if (context.role !== "supervisor" && context.role !== "broker") return and(tenant, sql`false`)!;
  return and(
    tenant,
    sql`exists (
      select 1 from ${schema.leads}
      where ${schema.leads.companyId} = ${schema.companies.id}
        and ${schema.leads.tenantId} = ${context.tenantId}
        and ${leadScope}
    )`,
  )!;
}
