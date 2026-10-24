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
