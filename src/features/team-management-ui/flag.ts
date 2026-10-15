import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";

/** Flag criada no G0 (catalog FEATURE_FLAGS.TEAM_MANAGEMENT). Aqui só se lê, pela mesma chave, sem duplicar o catálogo. */
export const TEAM_MANAGEMENT_FLAG_KEY = "feature_team_management_enabled";

export async function isTeamManagementEnabled() {
  return (await getSystemSetting(TEAM_MANAGEMENT_FLAG_KEY).catch(() => undefined)) === "true";
}
