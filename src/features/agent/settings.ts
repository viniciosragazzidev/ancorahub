import "server-only";

import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { getSystemSetting } from "@/features/system-settings/queries";

/**
 * Chaves do agente do diretor (plano §5.3 e D3/D6):
 * - `agent_director_writes_<tenantId>`: ações de escrita por empresa, desligadas por padrão até o piloto (Super-admin).
 * - `ai_agent_director_model`: modelo do OpenRouter para o agente (tool calling). Em branco: Claude Sonnet pelo OpenRouter
 *   quando há chave; sem chave, o provedor primário do motor.
 */
export const AGENT_DIRECTOR_MODEL_SETTING = "ai_agent_director_model";
export const AGENT_DIRECTOR_DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export function agentDirectorWritesSettingKey(tenantId: string) {
  return `agent_director_writes_${tenantId}`;
}

export async function isAgentDirectorWritesEnabled(tenantId: string) {
  return (await getSystemSetting(agentDirectorWritesSettingKey(tenantId)).catch(() => null)) === "true";
}

export async function resolveAgentDirectorModel() {
  const settings = await getAiEngineSettings();
  if (!settings.enabled) return null;
  const keys = { groqKey: settings.groqApiKey, openaiKey: settings.openaiApiKey, googleKey: settings.googleApiKey, openrouterKey: settings.openrouterApiKey };
  const chosen = (await getSystemSetting(AGENT_DIRECTOR_MODEL_SETTING).catch(() => null))?.trim();
  const hasOpenRouter = Boolean(settings.openrouterApiKey || process.env.OPENROUTER_API_KEY);
  // LGPD: nunca modelo gratuito (":free") para o agente, que lê nomes da equipe e da escala.
  if (chosen && hasOpenRouter && !chosen.endsWith(":free")) return { model: getAiModelInstance("openrouter", chosen, keys), label: chosen };
  if (hasOpenRouter) return { model: getAiModelInstance("openrouter", AGENT_DIRECTOR_DEFAULT_MODEL, keys), label: AGENT_DIRECTOR_DEFAULT_MODEL };
  if (settings.primaryModel.endsWith(":free")) return null;
  return { model: getAiModelInstance(settings.primaryProvider, settings.primaryModel, keys), label: `${settings.primaryProvider}/${settings.primaryModel}` };
}
