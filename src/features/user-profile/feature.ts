import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";

export const USER_PROFILE_FEATURE_FLAG = "feature_user_profile_enabled";

/** Super-admin global control: blocks the route and the sidebar shortcut when disabled. */
export async function isUserProfileEnabled() {
  return (await getSystemSetting(USER_PROFILE_FEATURE_FLAG)) !== "false";
}
