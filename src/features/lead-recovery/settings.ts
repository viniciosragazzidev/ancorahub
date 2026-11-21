import "server-only";

import { getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";

import { parseRecoverySettings, type RecoverySettings } from "./settings-core";

function settingKey(tenantId: string) {
  return `lead_recovery_${tenantId}`;
}

/** Configuração da recuperação da empresa (padrão: tudo desligado). */
export async function getRecoverySettings(tenantId: string): Promise<RecoverySettings> {
  return parseRecoverySettings(await getSystemSetting(settingKey(tenantId)).catch(() => null));
}

export async function saveRecoverySettings(tenantId: string, settings: RecoverySettings) {
  // Passa pelo parse para nunca gravar valor fora da regra (WAHA em passo de template, controle acima de 50%).
  await setSystemSetting(settingKey(tenantId), JSON.stringify(parseRecoverySettings(JSON.stringify(settings))));
}
