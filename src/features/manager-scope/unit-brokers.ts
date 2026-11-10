import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

/**
 * Corretores ativos da unidade, pela unidade ATUAL do vínculo (tenant_memberships.branch_id), nunca pela unidade
 * gravada numa escala ou plantão antigo (em 10/11, 47 escalas tinham a unidade diferente da atual do corretor).
 * Sem unidade: lista vazia (fail closed).
 */
export async function getUnitBrokerIds(tenantId: string, branchId: string | null): Promise<string[]> {
  if (!branchId) return [];
  const rows = await getDatabase()
    .select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, tenantId),
      eq(schema.tenantMemberships.branchId, branchId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
    ));
  return rows.map((row) => row.userId);
}
