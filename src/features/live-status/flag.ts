import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import { resolveLiveScope } from "./scope";

/** Chave por empresa, no padrão do visual Lite: `feature_live_status_strip_<tenantId>`. Desligada por padrão. */
export function liveStatusSettingKey(tenantId: string) {
  return `${FEATURE_FLAGS.LIVE_STATUS_STRIP.key}_${tenantId}`;
}

/** Tenant vem sempre do contexto autenticado ou de um alvo validado do Super-admin. */
export async function isLiveStatusEnabled(tenantId: string) {
  const value = await getSystemSetting(liveStatusSettingKey(tenantId)).catch(() => null);
  return (value ?? FEATURE_FLAGS.LIVE_STATUS_STRIP.defaultValue) === "true";
}

/** Só cria a região de carregamento para papéis que realmente têm escopo operacional. */
export async function shouldShowLiveStatusStrip(context: TenantContext) {
  if (!resolveLiveScope(context)) return false;
  return isLiveStatusEnabled(context.tenantId);
}
