import type { PermissionKey } from "@/shared/auth/permissions";
import type { TenantRole } from "@/shared/db/schema";
import { routePermissionForPath } from "@/features/custom-roles/routes";
import { isManagerRouteAllowed, isOutsideManagerScope } from "@/features/manager-scope/manager-routes";

export type NavigationAccessItem = {
  url: string;
  permission: PermissionKey;
  requires?: "relationshipCenter";
};

export type NavigationAccessUser = {
  roleKey: TenantRole | null;
  jobTitle: string | null;
  permissions?: readonly string[];
  relationshipCenterEnabled?: boolean;
};

const marketingHiddenPaths = [
  "/conversas", "/tarefas", "/documentos", "/clientes", "/vendas", "/checklist",
  "/minha-fila", "/dashboard", "/corretor", "/metas", "/relatorios", "/noc",
  "/filiais", "/unidades", "/gestor", "/diretor",
];
const brokerHiddenPaths = ["/cotacao", "/automacoes", "/filiais", "/unidades"];

function pathnameOf(url: string) {
  return url.split(/[?#]/, 1)[0] || "/";
}

function matchesHiddenPath(pathname: string, hiddenPath: string) {
  return pathname === hiddenPath || pathname.startsWith(`${hiddenPath}/`);
}

export function canShowNavigationItem(item: NavigationAccessItem, user: NavigationAccessUser | null) {
  const roleKey = user?.roleKey;
  if (!roleKey) return false;
  const pathname = pathnameOf(item.url);

  if (item.requires === "relationshipCenter" && (!user.relationshipCenterEnabled || roleKey === "broker")) return false;
  if (user.jobTitle === "marketing" && marketingHiddenPaths.some((path) => matchesHiddenPath(pathname, path))) return false;
  if (roleKey === "broker" && brokerHiddenPaths.some((path) => matchesHiddenPath(pathname, path))) return false;
  // Gestor na versão antiga (10/11): o menu mostra só as rotas que o servidor libera para ele.
  if (isOutsideManagerScope(roleKey, user.jobTitle) && !isManagerRouteAllowed(pathname)) return false;

  const permissions = user.permissions ?? [];
  const routePermission = routePermissionForPath(pathname);
  const explicitRoutes = permissions.filter((permission) => permission.startsWith("route:"));
  if (pathname === "/equipe") {
    if (explicitRoutes.length > 0) {
      return Boolean(routePermission && permissions.includes(routePermission))
        || permissions.includes("route:filiais")
        || permissions.includes("route:unidades")
        || permissions.includes("acessar_configuracoes_unidade");
    }
    return permissions.includes("convidar_corretor") || permissions.includes("acessar_configuracoes_unidade");
  }
  if (routePermission && explicitRoutes.length > 0) return permissions.includes(routePermission);
  return permissions.includes(item.permission);
}
