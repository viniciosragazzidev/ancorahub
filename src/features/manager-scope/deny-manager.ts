import "server-only";

import { redirect } from "next/navigation";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { isOutsideManagerScope, MANAGER_HOME_PATH } from "./manager-routes";

/**
 * Barra o gestor numa área inteira fora da gestão da unidade (10/11). Vai no layout da área: o layout do painel só
 * roda na carga completa, e o layout da área roda também quando se chega a ela por um link dentro do app.
 */
export async function redirectManagerAway() {
  const context = await getRequiredTenantContext();
  if (isOutsideManagerScope(context.role, context.jobTitle)) redirect(MANAGER_HOME_PATH);
  return context;
}
