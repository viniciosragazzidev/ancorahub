import { getDatabase, schema } from "@/shared/db";
import { and, eq } from "drizzle-orm";

export type SupervisorOption = {
  id: string;
  name: string;
  branchId: string | null;
};

/**
 * Retorna os supervisores ativos de uma determinada unidade do tenant.
 */
export async function getBranchSupervisors(
  tenantId: string,
  branchId: string
): Promise<SupervisorOption[]> {
  const db = getDatabase();
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      branchId: schema.tenantMemberships.branchId,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.branchId, branchId),
        eq(schema.tenantMemberships.role, "supervisor"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.active, true)
      )
    );

  return rows;
}

/**
 * Retorna os IDs dos corretores supervisionados por um usuário supervisor.
 */
export async function getSupervisedBrokerIds(
  tenantId: string,
  supervisorUserId: string
): Promise<string[]> {
  const db = getDatabase();
  const rows = await db
    .select({ brokerUserId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, tenantId),
        eq(schema.tenantMemberships.supervisorId, supervisorUserId),
        eq(schema.tenantMemberships.status, "active")
      )
    );

  return rows.map((r) => r.brokerUserId);
}
