import "server-only";

import type { LanguageModelV4 } from "@ai-sdk/provider";

import { getAiEngineSettings } from "@/features/ai/engine";
import { getAiModelInstance } from "@/features/ai/providers";
import { getSystemSetting } from "@/features/system-settings/queries";

/**
 * Chaves do agente do diretor (plano §5.3 e D3/D6):
 * - `agent_director_writes_<tenantId>`: ações de escrita por empresa. Ligadas por padrão desde 23/11 (antes só com "true",
 *   e nenhuma empresa tinha sido ligada: o agente recusava escalar no plantão). "false" no Super-admin desliga.
 * - `ai_agent_director_model`: modelo do OpenRouter para o agente (tool calling). Em branco: Claude Sonnet pelo OpenRouter.
 *
 * 22/11: a chave do OpenRouter salva no Super-admin estava revogada (401) e derrubava o agente. Agora a chave do
 * ambiente (Coolify) vem primeiro e, se o primeiro modelo recusar, o agente tenta o próximo da lista (Google, primário).
 */
export const AGENT_DIRECTOR_MODEL_SETTING = "ai_agent_director_model";
export { AGENT_DIRECTOR_DEFAULT_MODEL, AGENT_DIRECTOR_GOOGLE_MODEL } from "./settings-model";
import { AGENT_DIRECTOR_DEFAULT_MODEL, AGENT_DIRECTOR_GOOGLE_MODEL } from "./settings-model";

export function agentDirectorWritesSettingKey(tenantId: string) {
  return `agent_director_writes_${tenantId}`;
}

export async function isAgentDirectorWritesEnabled(tenantId: string) {
  return (await getSystemSetting(agentDirectorWritesSettingKey(tenantId)).catch(() => null)) !== "false";
}

type Candidate = { model: LanguageModelV4; label: string };

/**
 * Um modelo que tenta cada candidato em ordem até um responder. Erro de chave, de cota ou de modelo acontece na
 * chamada (antes do fluxo começar), então trocar de provedor ali não duplica nada na conversa.
 */
export function withFallback(candidates: Candidate[], onFallback?: (failed: string, error: unknown) => void): LanguageModelV4 {
  const [primary] = candidates;
  if (!primary) throw new Error("Nenhum modelo de IA disponível.");
  if (candidates.length === 1) return primary.model;
  // Provedor mudo não segura o diretor: cada tentativa (menos a última) tem até 15 s para começar a responder.
  const FIRST_BYTE_MS = 15_000;
  async function attempt<T>(run: (model: LanguageModelV4, signal: AbortSignal | undefined) => PromiseLike<T>, outer: AbortSignal | undefined): Promise<T> {
    let lastError: unknown;
    for (const [index, candidate] of candidates.entries()) {
      const last = index === candidates.length - 1;
      const signal = last ? outer : AbortSignal.any([...(outer ? [outer] : []), AbortSignal.timeout(FIRST_BYTE_MS)]);
      try {
        return await run(candidate.model, signal);
      } catch (error) {
        if (outer?.aborted) throw error;
        lastError = error;
        onFallback?.(candidate.label, error);
      }
    }
    throw lastError;
  }
  return {
    specificationVersion: primary.model.specificationVersion,
    provider: primary.model.provider,
    modelId: primary.model.modelId,
    get supportedUrls() {
      return primary.model.supportedUrls;
    },
    doGenerate: (options) => attempt((model, abortSignal) => model.doGenerate({ ...options, abortSignal }), options.abortSignal),
    doStream: (options) => attempt((model, abortSignal) => model.doStream({ ...options, abortSignal }), options.abortSignal),
  };
}

export async function resolveAgentDirectorModel(onFallback?: (failed: string, error: unknown) => void) {
  const settings = await getAiEngineSettings();
  if (!settings.enabled) return null;
  const chosen = (await getSystemSetting(AGENT_DIRECTOR_MODEL_SETTING).catch(() => null))?.trim();
  // LGPD: nunca modelo gratuito (":free") para o agente, que lê nomes da equipe e da escala.
  const openRouterModel = chosen && !chosen.endsWith(":free") ? chosen : AGENT_DIRECTOR_DEFAULT_MODEL;
  const envOpenRouter = process.env.OPENROUTER_API_KEY?.trim() || null;
  const dbOpenRouter = settings.openrouterApiKey?.trim() || null;
  const googleKey = settings.googleApiKey?.trim() || process.env.GOOGLE_API_KEY?.trim() || null;
  const candidates: Candidate[] = [];
  const add = (label: string, build: () => unknown) => {
    try {
      candidates.push({ model: build() as LanguageModelV4, label });
    } catch {
      /* provedor sem chave ou sem suporte: segue para o próximo */
    }
  };
  if (envOpenRouter) add(`openrouter/${openRouterModel} (ambiente)`, () => getAiModelInstance("openrouter", openRouterModel, { openrouterKey: envOpenRouter }));
  if (dbOpenRouter && dbOpenRouter !== envOpenRouter) add(`openrouter/${openRouterModel} (Super-admin)`, () => getAiModelInstance("openrouter", openRouterModel, { openrouterKey: dbOpenRouter }));
  if (googleKey) add(`google/${AGENT_DIRECTOR_GOOGLE_MODEL}`, () => getAiModelInstance("google", AGENT_DIRECTOR_GOOGLE_MODEL, { googleKey }));
  if (!candidates.length && !settings.primaryModel.endsWith(":free")) {
    const keys = { groqKey: settings.groqApiKey, openaiKey: settings.openaiApiKey, googleKey: settings.googleApiKey, openrouterKey: settings.openrouterApiKey };
    add(`${settings.primaryProvider}/${settings.primaryModel}`, () => getAiModelInstance(settings.primaryProvider, settings.primaryModel, keys));
  }
  if (!candidates.length) return null;
  return { model: withFallback(candidates, onFallback), label: candidates.map((candidate) => candidate.label).join(" → ") };
}
