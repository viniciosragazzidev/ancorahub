import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

export function directorLiteStyleSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.DIRECTOR_LITE_STYLE.key}_${tenantId}`;
}

/** Tenant IDs must come from the authenticated context or a validated admin target. */
export async function isDirectorLiteStyleEnabled(tenantId: string) {
  const value = await getSystemSetting(directorLiteStyleSettingKey(tenantId)).catch(() => null);
  return value === "true";
}

export async function shouldUseDirectorLiteStyle(role: string, tenantId: string) {
  if (role !== "director") return false;
  return isDirectorLiteStyleEnabled(tenantId);
}

/**
 * Regra de página do Diretor Lite no servidor (a mesma do useDirectorLitePage no cliente): diretor com a chave da
 * empresa ligada e a rota fora do opt-out. As páginas que trocam para o Lite no servidor usam só esta função.
 */
export async function isDirectorLitePageOnServer(role: string, tenantId: string, pathname: string) {
  const { isDirectorLiteRouteOptedOut } = await import("@/components/arc/director-lite-routes");
  if (isDirectorLiteRouteOptedOut(pathname)) return false;
  return shouldUseDirectorLiteStyle(role, tenantId).catch(() => false);
}
