import "server-only";

import { getSystemSetting } from "@/features/system-settings/queries";

/**
 * Camada de IA dinâmica da Sasá (19/11), por empresa: `sasa_dynamic_ai_<tenantId>`. Ligada por padrão (a Sasá já é
 * só do piloto); o Super-admin desliga para cortar custo. Desligada, a Sasá continua com as respostas diretas.
 */
export function sasaDynamicAiSettingKey(tenantId: string) {
  return `sasa_dynamic_ai_${tenantId}`;
}

export async function isSasaDynamicAiEnabled(tenantId: string) {
  return (await getSystemSetting(sasaDynamicAiSettingKey(tenantId)).catch(() => null)) !== "false";
}
