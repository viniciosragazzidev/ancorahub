import "server-only";

import { getSystemSetting, getSystemSettings } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { resolveAutoSaleSettings, type AutoSaleSettings } from "./settings";

/** Chave por empresa: `feature_auto_sale_<tenantId>`. Desligada por padrão. */
export function autoSaleSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.AUTO_SALE.key}_${tenantId}`;
}

/** Chave por empresa do Autopiloto (F4): `feature_auto_sale_autopilot_<tenantId>`. Desligada por padrão. */
export function autoSaleAutopilotSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.AUTO_SALE_AUTOPILOT.key}_${tenantId}`;
}

/** Parâmetros editáveis por empresa (JSON), no Super-admin. */
export function autoSaleParamsSettingKey(tenantId: string) {
  return `auto_sale_settings_${tenantId}`;
}

export type AutoSaleFlags = { enabled: boolean; global: boolean; autopilot: boolean; settings: AutoSaleSettings };

/** Tenant vem sempre do contexto autenticado ou do webhook já resolvido, nunca do cliente. */
export async function readAutoSaleFlags(tenantId: string): Promise<AutoSaleFlags> {
  const keys = [autoSaleSettingKey(tenantId), autoSaleAutopilotSettingKey(tenantId), autoSaleParamsSettingKey(tenantId), FEATURE_FLAGS.AUTO_SALE_GLOBAL.key];
  const rows = await getSystemSettings(keys).catch(() => []);
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    enabled: (map.get(keys[0]) ?? FEATURE_FLAGS.AUTO_SALE.defaultValue) === "true",
    autopilot: (map.get(keys[1]) ?? FEATURE_FLAGS.AUTO_SALE_AUTOPILOT.defaultValue) === "true",
    settings: resolveAutoSaleSettings(map.get(keys[2])),
    global: (map.get(keys[3]) ?? FEATURE_FLAGS.AUTO_SALE_GLOBAL.defaultValue) !== "false",
  };
}

export async function isAutoSaleEnabled(tenantId: string) {
  const value = await getSystemSetting(autoSaleSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.AUTO_SALE.defaultValue) === "true";
}
