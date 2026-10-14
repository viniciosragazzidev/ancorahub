import { and, eq, sql, type SQL } from "drizzle-orm";

import { inSupervisorTeam } from "@/features/team/supervisor-scope";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

/** Customer renewals follow the stored customer ownership, with tenant isolation for every role. */
export function buildCustomerRenewalStatusScope(context: TenantContext): SQL {
  const conditions: SQL[] = [eq(schema.activeCustomers.tenantId, context.tenantId)];

  if (context.role === "manager") {
    conditions.push(context.branchId
      ? eq(schema.activeCustomers.branchId, context.branchId)
      : sql`false`);
  } else if (context.role === "supervisor") {
    conditions.push(inSupervisorTeam(schema.activeCustomers.brokerId, context.tenantId, context.userId));
  } else if (context.role === "broker") {
    conditions.push(eq(schema.activeCustomers.brokerId, context.userId));
  } else if (context.role !== "director") {
    conditions.push(sql`false`);
  }

  return and(...conditions)!;
}
