import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";

import { DISABLED_TWO_FACTOR_POLICY, parseTwoFactorPolicy, twoFactorPolicyKey, type TwoFactorPolicy } from "./two-factor-policy";

/**
 * A exigência de 2FA da empresa. Lida do cache de system_settings (15 s, o mesmo das flags do layout): não custa
 * consulta a mais por navegação. Sem leitura, vale como desligada (nunca trava a equipe por falha de banco).
 */
export async function getTwoFactorPolicy(tenantId: string): Promise<TwoFactorPolicy> {
  try {
    return parseTwoFactorPolicy(await getSystemSetting(twoFactorPolicyKey(tenantId)));
  } catch {
    return DISABLED_TWO_FACTOR_POLICY;
  }
}
