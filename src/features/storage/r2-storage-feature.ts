import "server-only";
import { getSystemSetting } from "@/features/system-settings/queries";

export const R2_STORAGE_FEATURE_SETTING = "feature_r2_storage_enabled";
export async function isR2StorageEnabled() {
  return (await getSystemSetting(R2_STORAGE_FEATURE_SETTING)) !== "false";
}
