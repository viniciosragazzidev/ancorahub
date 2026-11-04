import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

export type CustomerWaitingMode = "off" | "observe";

/** Chave por empresa, no padrão do visual Lite: `feature_customer_waiting_guard_<tenantId>`. Desligada por padrão. */
export function customerWaitingSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.CUSTOMER_WAITING_GUARD.key}_${tenantId}`;
}

export function parseCustomerWaitingMode(value: string | null | undefined): CustomerWaitingMode {
  return value === "observe" ? "observe" : "off";
}

/** Tenant vem sempre do contexto autenticado ou de um alvo validado do Super-admin. */
export async function getCustomerWaitingMode(tenantId: string): Promise<CustomerWaitingMode> {
  const value = await getSystemSetting(customerWaitingSettingKey(tenantId)).catch(() => null);
  return parseCustomerWaitingMode(value ?? FEATURE_FLAGS.CUSTOMER_WAITING_GUARD.defaultValue);
}

/** When the observation was switched on: cycles whose clock started before it are not recorded (no backfill). */
export function customerWaitingSinceKey(tenantId: string) {
  return `${customerWaitingSettingKey(tenantId)}_since`;
}
