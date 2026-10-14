import { and, eq, sql, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";
import { inSupervisorTeam } from "@/features/team/supervisor-scope";

export function buildNocLeadScope(context: TenantContext): SQL {
  const tenant = eq(schema.leads.tenantId, context.tenantId);
  if (context.role === "director") return tenant;
  if (context.role === "manager") {
    return and(tenant, context.branchId ? eq(schema.leads.branchId, context.branchId) : sql`false`)!;
  }
  if (context.role === "supervisor") {
    return and(tenant, inSupervisorTeam(schema.leads.corretorId, context.tenantId, context.userId))!;
  }
  if (context.role === "broker") return and(tenant, eq(schema.leads.corretorId, context.userId))!;
  return and(tenant, sql`false`)!;
}

export function buildNocMembershipScope(context: TenantContext): SQL {
  const conditions: SQL[] = [
    eq(schema.tenantMemberships.tenantId, context.tenantId),
    eq(schema.tenantMemberships.role, "broker"),
    eq(schema.tenantMemberships.status, "active"),
  ];
  if (context.role === "manager") {
    conditions.push(context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : sql`false`);
  } else if (context.role === "supervisor") {
    conditions.push(eq(schema.tenantMemberships.supervisorId, context.userId));
  } else if (context.role !== "director") {
    conditions.push(sql`false`);
  }
  return and(...conditions)!;
}

export function buildNocBranchScope(context: TenantContext): SQL {
  const conditions: SQL[] = [
    eq(schema.branches.tenantId, context.tenantId),
    eq(schema.branches.status, "active"),
  ];
  if (context.role === "manager") {
    conditions.push(context.branchId ? eq(schema.branches.id, context.branchId) : sql`false`);
  } else if (context.role !== "director") {
    conditions.push(sql`false`);
  }
  return and(...conditions)!;
}

export function canViewNocBranchHealth(context: TenantContext) {
  return context.role === "director" || (context.role === "manager" && Boolean(context.branchId));
}
