import "server-only";
import type { PermissionKey } from "@/shared/auth/permissions";
import { canSeeAgencyBooks, requireErpAccess } from "./access";
import { erpModuleForImplementedPath } from "./implemented-routes";
import type { ErpModuleKey } from "./contracts";

const moduleCapabilities: Record<ErpModuleKey, PermissionKey> = {
  implantations: "erp_view_operations", finance: "erp_view_finance", imports: "erp_import_data",
  referrals: "erp_manage_referrals", incentives: "erp_view_analytics", analytics: "erp_view_analytics", tv: "erp_view_analytics",
};

/** A role shell exception only for an implemented, enabled and authorized ERP route. */
export async function canEnterErpRoute(pathname: string) {
  const moduleKey = erpModuleForImplementedPath(pathname);
  if (!moduleKey) return false;
  try {
    const auth = await requireErpAccess(moduleKey, moduleCapabilities[moduleKey]);
    if (pathname.startsWith("/financeiro/fluxo-caixa")) return canSeeAgencyBooks(auth.context) && auth.scope.mode !== "owners";
    if (pathname.startsWith("/financeiro/fechamentos")) return canSeeAgencyBooks(auth.context) && auth.scope.mode === "tenant";
    return true;
  } catch { return false; }
}
