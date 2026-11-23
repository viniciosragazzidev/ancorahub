import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";

/**
 * Camada de IA dinâmica do Sasá (19/11), por empresa: `sasa_dynamic_ai_<tenantId>`. Ligada por padrão (o Sasá já é
 * só do piloto); o Super-admin desliga para cortar custo. Desligada, o Sasá continua com as respostas diretas.
 */
export function sasaDynamicAiSettingKey(tenantId: string) {
  return `sasa_dynamic_ai_${tenantId}`;
}

export async function isSasaDynamicAiEnabled(tenantId: string) {
  return (await getSystemSetting(sasaDynamicAiSettingKey(tenantId)).catch(() => null)) !== "false";
}
