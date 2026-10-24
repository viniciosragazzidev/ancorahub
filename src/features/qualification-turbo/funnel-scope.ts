import type { TenantContext } from "@/shared/auth/types";

/** Diretores usam somente a unidade já validada no servidor; gestores ficam na unidade da sessão. */
export function resolveFunnelBranchScope(
  context: Pick<TenantContext, "role" | "branchId">,
  requestedBranchId?: string | null,
): string | null {
  if (context.role === "director") return requestedBranchId ?? null;
  if (!context.branchId) throw new Error("Funil disponível só para a unidade do gestor.");
  return context.branchId;
}
