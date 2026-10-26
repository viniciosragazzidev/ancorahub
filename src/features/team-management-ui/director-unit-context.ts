import "server-only";

import { and, asc, eq } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

/**
 * /gestao para o diretor (decisão do Vinicios, 25/10): o diretor escolhe uma unidade da própria empresa e vê a mesma
 * gestão que o gestor daquela unidade vê. O contexto derivado tem o papel de gestor e a unidade escolhida; como o
 * diretor já enxerga a empresa inteira, isso só restringe o que ele vê. A unidade vem sempre validada contra o tenant
 * do contexto autenticado (nunca do cliente sem conferência).
 */
export type DirectorUnitChoice = {
  branches: Array<{ id: string; name: string }>;
  branchId: string;
  unitContext: TenantContext;
};

export function deriveUnitContext(context: TenantContext, branchId: string): TenantContext {
  return { ...context, role: "manager", branchId, customRoleId: null, customRoleScope: null, supervisorTeamScope: false };
}

export async function resolveDirectorUnit(context: TenantContext, requestedBranchId: string | null | undefined): Promise<DirectorUnitChoice | null> {
  if (context.role !== "director") return null;
  const branches = await getDatabase()
    .select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
    .orderBy(asc(schema.branches.name));
  if (!branches.length) return null;
  const chosen = branches.find((branch) => branch.id === requestedBranchId) ?? branches[0]!;
  return { branches, branchId: chosen.id, unitContext: deriveUnitContext(context, chosen.id) };
}

/** Unidade da equipe de um supervisor da mesma empresa (para abrir /gestao/equipes/[id] no contexto certo). */
export async function findSupervisorBranch(context: TenantContext, supervisorId: string): Promise<string | null> {
  if (context.role !== "director") return null;
  const [row] = await getDatabase()
    .select({ branchId: schema.tenantMemberships.branchId })
    .from(schema.tenantMemberships)
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, supervisorId.slice(0, 80)),
      eq(schema.tenantMemberships.role, "supervisor"),
      eq(schema.tenantMemberships.status, "active"),
    ))
    .limit(1);
  return row?.branchId ?? null;
}
