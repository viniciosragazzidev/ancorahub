import "server-only";

import { getSystemSettings } from "@/features/system-settings/queries";

export const CLEAN_UI_FEATURE = "feature_clean_ui_operational_enabled";
export const CLEAN_UI_LEGACY_TENANTS_SETTING = "clean_ui_operational_legacy_tenant_ids";

function parseTenantIds(value: string | undefined) {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item))
      : [];
  } catch {
    return [];
  }
}

export async function getCleanUiOperationalLegacyTenantIds() {
  const settings = await getSystemSettings([CLEAN_UI_LEGACY_TENANTS_SETTING]);
  return parseTenantIds(settings[0]?.value);
}

export async function isCleanUiOperationalEnabled(tenantId: string) {
  const settings = await getSystemSettings([CLEAN_UI_FEATURE, CLEAN_UI_LEGACY_TENANTS_SETTING]);
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  return values.get(CLEAN_UI_FEATURE) !== "false" && !parseTenantIds(values.get(CLEAN_UI_LEGACY_TENANTS_SETTING)).includes(tenantId);
}
