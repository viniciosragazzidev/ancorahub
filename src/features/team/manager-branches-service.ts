import { and, eq, inArray } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { AccessContext } from "@/shared/auth/access-context";
import { AuthorizationError } from "@/shared/auth/errors";

/**
 * Retorna as filiais associadas a um gestor multi-unidade.
 */
export async function getManagerBranchIds(
  tenantId: string,
  managerUserId: string,
): Promise<string[]> {
  const db = getDatabase();
  const rows = await db
    .select({ branchId: schema.tenantManagerBranches.branchId })
    .from(schema.tenantManagerBranches)
    .where(
      and(
        eq(schema.tenantManagerBranches.tenantId, tenantId),
        eq(schema.tenantManagerBranches.userId, managerUserId),
      ),
    );

  return rows.map((r) => r.branchId);
}

/**
 * Atualiza o vínculo de filiais de um gestor de forma canônica e autorizada.
 *
 * Invariantes invioláveis:
 * 1. Isolamento multi-tenant absoluto (todas as filiais devem pertencer ao tenantId do actor).
 * 2. Scope Escalation Protection: Ator não pode conceder unidades que ele próprio não administra.
 * 3. Self-Escalation Protection: Ator não pode adicionar unidades a si próprio a menos que seja Diretor.
 * 4. Validação de existência: Filiais inexistentes ou de outros tenants são rejeitadas.
 */
export async function setManagerBranchesAuthorized(params: {
  actorContext: AccessContext;
  targetUserId: string;
  requestedBranchIds: string[];
}): Promise<{ assignedBranchIds: string[] }> {
  const { actorContext, targetUserId, requestedBranchIds } = params;
  const db = getDatabase();

  // 1. Autorização básica do ator
  const isDirector = actorContext.role === "director" || actorContext.canAccessAllUnits;
  const canManageTeam = isDirector || actorContext.permissions.has("gerenciar_filiais") || actorContext.permissions.has("convidar_gestor");
  if (!canManageTeam) {
    throw new AuthorizationError("Permissão insuficiente para gerenciar filiais de gestores.");
  }

  // 2. Proteção contra auto-escalonamento
  if (actorContext.userId === targetUserId && !isDirector) {
    throw new AuthorizationError("Não é permitido alterar as próprias filiais administradas.");
  }

  // 3. Se a lista de filiais solicitadas estiver vazia, remove todas as associações
  const uniqueBranchIds = Array.from(new Set(requestedBranchIds.filter(Boolean)));
  if (uniqueBranchIds.length === 0) {
    await db
      .delete(schema.tenantManagerBranches)
      .where(
        and(
          eq(schema.tenantManagerBranches.tenantId, actorContext.tenantId),
          eq(schema.tenantManagerBranches.userId, targetUserId),
        ),
      );
    return { assignedBranchIds: [] };
  }

  // 4. Validação de existência no tenant (Rejeita cross-tenant e IDs forjados)
  const validTenantBranches = await db
    .select({ id: schema.branches.id })
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.tenantId, actorContext.tenantId),
        inArray(schema.branches.id, uniqueBranchIds),
      ),
    );

  const validBranchIdSet = new Set(validTenantBranches.map((b) => b.id));
  for (const branchId of uniqueBranchIds) {
    if (!validBranchIdSet.has(branchId)) {
      throw new AuthorizationError(`A filial ${branchId} não existe ou não pertence a este tenant.`);
    }
  }

  // 5. Scope Escalation Protection: Ator não-diretor só pode atribuir filiais dentro do seu allowedUnitIds
  if (!isDirector) {
    const actorAllowedSet = new Set(actorContext.allowedUnitIds);
    for (const branchId of uniqueBranchIds) {
      if (!actorAllowedSet.has(branchId)) {
        throw new AuthorizationError(`Você não tem autorização para gerenciar a filial ${branchId}.`);
      }
    }
  }

  // 6. Transação de escrita canônica
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.tenantManagerBranches)
      .where(
        and(
          eq(schema.tenantManagerBranches.tenantId, actorContext.tenantId),
          eq(schema.tenantManagerBranches.userId, targetUserId),
        ),
      );

    const records = uniqueBranchIds.map((branchId) => ({
      id: crypto.randomUUID(),
      tenantId: actorContext.tenantId,
      userId: targetUserId,
      branchId,
    }));

    await tx.insert(schema.tenantManagerBranches).values(records);
  });

  return { assignedBranchIds: uniqueBranchIds };
}

/**
 * Atualiza o vínculo de filiais de um gestor (wrapper legado).
 */
export async function setManagerBranches(
  tenantId: string,
  managerUserId: string,
  branchIds: string[],
): Promise<void> {
  const db = getDatabase();
  await db
    .delete(schema.tenantManagerBranches)
    .where(
      and(
        eq(schema.tenantManagerBranches.tenantId, tenantId),
        eq(schema.tenantManagerBranches.userId, managerUserId),
      ),
    );

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
