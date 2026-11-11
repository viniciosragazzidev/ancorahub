import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/** Chave por empresa: `feature_lite_accept_handoff_<tenantId>`. Desligada por padrão. */
export function acceptHandoffSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.LITE_ACCEPT_HANDOFF.key}_${tenantId}`;
}

/** Aceite com contador (11/11): ligado, o WhatsApp abre depois de 30 s na tela do lead. */
export async function isAcceptHandoffEnabled(tenantId: string) {
  const value = await getSystemSetting(acceptHandoffSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.LITE_ACCEPT_HANDOFF.defaultValue) === "true";
}
