import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/** Chave por empresa: `feature_broker_ad_context_<tenantId>`. Desligada por padrão. */
export function brokerAdContextSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.BROKER_AD_CONTEXT.key}_${tenantId}`;
}

/** Tenant vem sempre do contexto autenticado ou de um alvo validado do Super-admin. */
export async function isBrokerAdContextEnabled(tenantId: string) {
  const value = await getSystemSetting(brokerAdContextSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.BROKER_AD_CONTEXT.defaultValue) === "true";
}
