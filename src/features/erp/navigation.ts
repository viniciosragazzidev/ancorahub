import "server-only";
import { cache } from "react";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { getRouteDefinition } from "@/features/custom-roles/routes";
import { ERP_IMPLEMENTED_ROUTES } from "./route-reservations";
import { getErpEffectiveAccess, getErpPlatformState } from "./access";
import { canEnterErpRoute } from "./route-access";

export type ErpNavigationLink = { href: string; label: string };
export const getErpNavigation = cache(async (): Promise<ErpNavigationLink[]> => {
  const context = await getRequiredTenantContext();
  const platform = await getErpPlatformState();
  // Until the platform turns the ERP on, nothing of it shows (not even governance): the tables may not exist yet.
  if (!platform.enabled) return [];
  const access = await getErpEffectiveAccess(context);
  const links: ErpNavigationLink[] = [];
  for (const route of ERP_IMPLEMENTED_ROUTES) {
    if (!canAccessRoute(access, getRouteDefinition(route.path))) continue;
    const governance = route.path === "/administracao/erp" && context.role === "director" && !context.customRoleId && !context.viewAs;
    if (governance || await canEnterErpRoute(route.path)) links.push({ href: route.path, label: route.path === "/financeiro" && ["broker", "supervisor"].includes(context.role) && context.jobTitle !== "finance" ? "Meu financeiro" : route.label });
  }
  return links;
});
