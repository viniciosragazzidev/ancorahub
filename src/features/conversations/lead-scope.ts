import { and, eq, sql, type SQL } from "drizzle-orm";

import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

/** Tenant and role boundary for leads shown by the central conversations list. */
export function buildConversationLeadScope(context: TenantContext): SQL {
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
