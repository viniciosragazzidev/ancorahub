import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/** Chave por empresa, no padrão do visual Lite: `feature_live_status_strip_<tenantId>`. Desligada por padrão. */
export function liveStatusSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.LIVE_STATUS_STRIP.key}_${tenantId}`;
}

/** Tenant vem sempre do contexto autenticado ou de um alvo validado do Super-admin. */
export async function isLiveStatusEnabled(tenantId: string) {
  const value = await getSystemSetting(liveStatusSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.LIVE_STATUS_STRIP.defaultValue) === "true";
}
