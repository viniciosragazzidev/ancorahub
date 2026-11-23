import "server-only";

import { AuthorizationError } from "@/shared/auth/errors";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import type { TenantContext } from "@/shared/auth/types";

/**
 * Quem pode ligar/desligar a captura de leads da Meta da empresa: o mesmo grupo que conecta
 * a Meta (`confirmMetaConnection`, `manual-meta-actions.ts`): diretor, gestor ou cargo de
 * marketing. "Ver como" é somente leitura: o admin observando outro usuário nunca altera a captura.
 */
export function assertMetaCaptureManager(context: TenantContext): TenantContext {
  if (context.viewAs) {
    throw new AuthorizationError("A visualização de outro usuário é somente leitura.");
  }
  if (context.role !== "director" && context.role !== "manager" && context.jobTitle !== "marketing") {
    throw new AuthorizationError("Apenas Diretores, Gestores ou Marketing podem alterar a captura de leads da Meta.");
  }
  return context;
}

export async function requireMetaCaptureManager(): Promise<TenantContext> {
  return assertMetaCaptureManager(await getRequiredTenantContext());
}
