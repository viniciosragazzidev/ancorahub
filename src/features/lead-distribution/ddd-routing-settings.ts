import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { DEFAULT_DDD_ROUTING_SETTINGS, normalizeDddRoutingSettings, type DddRoutingSettings } from "./ddd-routing";

/** Per-tenant key in system_settings (no migration needed), like meta_lead_capture_mode_<tenant>. */
export function dddRoutingSettingKey(tenantId: string) {
  return `ddd_routing_${tenantId}`;
}

export async function getDddRoutingSettings(tenantId: string): Promise<DddRoutingSettings> {
  try {
    const stored = await getSystemSetting(dddRoutingSettingKey(tenantId));
    return stored ? normalizeDddRoutingSettings(JSON.parse(stored)) : DEFAULT_DDD_ROUTING_SETTINGS;
  } catch {
    return DEFAULT_DDD_ROUTING_SETTINGS;
  }
}
