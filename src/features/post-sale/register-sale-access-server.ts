import "server-only";

import { canAccessRoute } from "@/features/custom-roles/effective-access";
import { routeCatalog } from "@/features/custom-roles/routes";
import { getEffectiveAccess } from "@/features/custom-roles/service";
import type { TenantContext } from "@/shared/auth/tenant-context";

/**
 * The cargo also decides (Vigia, 04/11): the button only shows when the action would pass,
 * that is, alterar_status_lead and the leads route (the area of src/features/post-sale).
 */
export async function cargoAllowsRegisterSale(context: Pick<TenantContext, "tenantId" | "role" | "jobTitle" | "customRoleId">) {
  try {
    const access = await getEffectiveAccess({ tenantId: context.tenantId, role: context.role, jobTitle: context.jobTitle, customRoleId: context.customRoleId ?? null });
    return access.capabilities.has("alterar_status_lead") && canAccessRoute(access, routeCatalog.find((route) => route.key === "leads"));
  } catch {
    return false;
  }
}
