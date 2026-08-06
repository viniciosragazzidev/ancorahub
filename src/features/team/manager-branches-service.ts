import { getDatabase, schema } from "@/shared/db";
import { and, eq } from "drizzle-orm";

/**
 * Retorna as filiais associadas a um gestor multi-unidade.
 */
export async function getManagerBranchIds(
  tenantId: string,
  managerUserId: string
): Promise<string[]> {
  const db = getDatabase();
  const rows = await db
    .select({ branchId: schema.tenantManagerBranches.branchId })
    .from(schema.tenantManagerBranches)
    .where(
      and(
        eq(schema.tenantManagerBranches.tenantId, tenantId),
        eq(schema.tenantManagerBranches.userId, managerUserId)
      )
    );

  return rows.map((r) => r.branchId);
}

/**
 * Atualiza o vínculo de filiais de um gestor.
 */
export async function setManagerBranches(
  tenantId: string,
  managerUserId: string,
  branchIds: string[]
): Promise<void> {
  const db = getDatabase();
  // Remove atribuições antigas do gestor
  await db
    .delete(schema.tenantManagerBranches)
    .where(
      and(
        eq(schema.tenantManagerBranches.tenantId, tenantId),
        eq(schema.tenantManagerBranches.userId, managerUserId)
      )
    );

  // Insere novas filiais se houver
  if (branchIds.length > 0) {
    const records = branchIds.map((branchId) => ({
      id: crypto.randomUUID(),
      tenantId,
      userId: managerUserId,
      branchId,
    }));
    await db.insert(schema.tenantManagerBranches).values(records);
  }
}
