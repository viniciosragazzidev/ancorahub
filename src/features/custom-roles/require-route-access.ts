import "server-only";

import { redirect } from "next/navigation";

import { isManagerRouteAllowed, isOutsideManagerScope, MANAGER_HOME_PATH } from "@/features/manager-scope/manager-routes";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";

import { canAccessRoute } from "./effective-access";
import { getRouteDefinition } from "./routes";
import { getEffectiveAccess } from "./service";

/**
 * Aplica as regras de acesso de outra rota (20/11). Uso: páginas que o next.config redireciona para uma aba com
 * ?tab= (ex.: /configuracoes/comissoes vira /settings?tab=comissoes). A guarda do layout só olha o caminho sem a
 * query; sem isto, quem pode abrir /settings veria as comissões. Mesmas regras do layout: gestor fora do escopo
 * volta ao início dele, e cargo sem a rota original vai para o acesso negado.
 */
export async function requireRouteAccess(path: string) {
  const context = await getRequiredTenantContext();
  if (isOutsideManagerScope(context.role, context.jobTitle) && !isManagerRouteAllowed(path)) redirect(MANAGER_HOME_PATH);
  const access = await getEffectiveAccess({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
  });
  if (!canAccessRoute(access, getRouteDefinition(path))) redirect("/access-denied");
  return context;
}
