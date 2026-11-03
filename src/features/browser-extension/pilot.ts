import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";

export const EXTENSION_PILOT_USERS_SETTING = "feature_browser_extension_pilot_users";

/** A missing or empty allowlist is closed: no user is enabled by default. */
export async function isExtensionPilotUser(userId: string) {
  if (!userId) return false;
  const value = await getSystemSetting(EXTENSION_PILOT_USERS_SETTING);
  return new Set((value ?? "").split(/[\r\n,]+/).map((id) => id.trim()).filter(Boolean)).has(userId);
}
