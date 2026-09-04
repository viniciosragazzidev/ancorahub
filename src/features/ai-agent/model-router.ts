import { getSystemSetting } from "@/features/system-settings/queries";

/**
 * Roteador automático entre provedores de IA (Groq + OpenRouter).
 *
 * O agente e o simulador nunca dependem de um único provedor: se um estiver
 * sem créditos, em rate-limit ou com modelo indisponível, o roteador tenta o
 * próximo em cadeia e só falha quando TODOS falham.
 *
 * Configuração (env):
 * - GROQ_API_KEY            chave da Groq (ou setting `ai_groq_api_key`)
 * - GROQ_MODEL              modelo Groq (default: llama-3.3-70b-versatile)
 * - OPENROUTER_API_KEY      chave do OpenRouter (ou setting `openrouter_key_<tenantId>`)
 * - OPENROUTER_MODEL        modelo OpenRouter (default: google/gemma-2-9b-it:free)
 * - AI_PROVIDER_ORDER       ordem de preferência, separada por vírgula
 *                           (default: groq,openrouter)
 *
 * Overrides por tenant (system settings, auditáveis):
 * - groq_model_<tenantId>
 * - openrouter_model_<tenantId>
 */

export type AiProviderId = "groq" | "openrouter";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiRouterCall = {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Usado apenas na chamada principal (saída estruturada). */
  responseFormat?: { type: "json_object" };
  /**
   * Provedor/modelo que já respondeu nesta conversa. Se informado, é tentado
   * primeiro (mantém a continuidade de retries de correção no mesmo modelo).
   */
  prefer?: { provider: AiProviderId; model: string };
};

export type AiRouterResult = {
  response: Response;
  model: string;
  provider: AiProviderId;
};

export type AiRouter = {
  /** Provedores configurados (com chave válida), na ordem de tentativa. */
  providers: AiProviderId[];
  call(input: AiRouterCall): Promise<AiRouterResult>;
};

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const LEGACY_OPENROUTER_MODEL = "anthropic/claude-3.5-sonnet";

type ProviderConfig = {
  id: AiProviderId;
  endpoint: string;
  apiKey: string;
  /** Modelos tentados em ordem (primário e fallback interno do provedor). */
  models: string[];
  extraHeaders?: Record<string, string>;
};

/** Só consulta system settings quando há banco configurado (evita DB real em testes). */
const canReadDb = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

async function trySetting(key: string): Promise<string | null> {
  if (!canReadDb) return null;
  try {
    return (await getSystemSetting(key))?.trim() || null;
  } catch {
    return null;
  }
}

async function resolveProviderConfigs(tenantId: string): Promise<ProviderConfig[]> {
  const [
    groqKeySetting,
    tenantGroqKeySetting,
    openrouterKeySetting,
    tenantOpenrouterKeySetting,
    groqModelSetting,
    openrouterModelSetting,
  ] = await Promise.all([
    trySetting("ai_groq_api_key"),
    trySetting(`groq_key_${tenantId}`),
    trySetting("ai_openrouter_api_key"),
    trySetting(`openrouter_key_${tenantId}`),
    trySetting(`groq_model_${tenantId}`),
    trySetting(`openrouter_model_${tenantId}`),
  ]);

  const groqApiKey = process.env.GROQ_API_KEY || tenantGroqKeySetting || groqKeySetting || "";
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || tenantOpenrouterKeySetting || openrouterKeySetting || "";


  const groqModel =
    process.env.GROQ_MODEL?.trim() ||
    groqModelSetting ||
    DEFAULT_GROQ_MODEL;

  const openrouterModel =
    openrouterModelSetting && openrouterModelSetting !== LEGACY_OPENROUTER_MODEL
      ? openrouterModelSetting
      : process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;

  const order = (process.env.AI_PROVIDER_ORDER || "groq,openrouter")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is AiProviderId => provider === "groq" || provider === "openrouter");

  const byId: Record<AiProviderId, ProviderConfig> = {
    groq: {
      id: "groq",
      endpoint: GROQ_ENDPOINT,
      apiKey: groqApiKey,
      models: groqModel === DEFAULT_GROQ_MODEL ? [groqModel] : [groqModel, DEFAULT_GROQ_MODEL],
    },
    openrouter: {
      id: "openrouter",
      endpoint: OPENROUTER_ENDPOINT,
      apiKey: openrouterApiKey,
      models: openrouterModel === DEFAULT_OPENROUTER_MODEL ? [openrouterModel] : [openrouterModel, DEFAULT_OPENROUTER_MODEL],
      extraHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://crm.ancorasaude.cloud",
        "X-Title": "Âncora Corretora CRM AI Agent",
      },
    },
  };

  return order.map((provider) => byId[provider]).filter((config) => config.apiKey);
}

export async function createAiRouter(tenantId: string): Promise<AiRouter> {
  const configs = await resolveProviderConfigs(tenantId);

  async function call(input: AiRouterCall): Promise<AiRouterResult> {
    if (configs.length === 0) {
      throw { status: 502, errText: "Nenhum provedor de IA configurado (GROQ_API_KEY ou OPENROUTER_API_KEY)." };
    }

    // Lista plana de (provedor × modelo) já na ordem de preferência.
    const pairs: Array<{ provider: AiProviderId; endpoint: string; apiKey: string; model: string; extraHeaders?: Record<string, string> }> = [];
    for (const config of configs) {
      for (const model of config.models) {
        pairs.push({ provider: config.id, endpoint: config.endpoint, apiKey: config.apiKey, model, extraHeaders: config.extraHeaders });
      }
    }

    // Se um provedor/modelo já respondeu nesta conversa, tente-o primeiro
    if (input.prefer) {
      const index = pairs.findIndex(
        (pair) => pair.provider === input.prefer?.provider && pair.model === input.prefer?.model,
      );
      if (index > 0) {
        const [preferred] = pairs.splice(index, 1);
        pairs.unshift(preferred);
      }
    }

    const lastError = { status: 502, errText: "" };

    for (const pair of pairs) {
      try {
        const response = await fetch(pair.endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(12000),
          headers: {
            "Authorization": `Bearer ${pair.apiKey}`,
            "Content-Type": "application/json",
            ...pair.extraHeaders,
          },
          body: JSON.stringify({
            model: pair.model,
            messages: input.messages,
            temperature: input.temperature ?? 0.3,
            max_tokens: input.maxTokens ?? 400,
            ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
          }),
        });

        if (response.ok) {
          console.info("[ai-router] provider_ok", { provider: pair.provider, model: pair.model });
          return { response, model: pair.model, provider: pair.provider };
        }

        lastError.status = response.status;
        lastError.errText = (await response.text().catch(() => "")).slice(0, 300);
        console.warn("[ai-router] provider_failed", {
          provider: pair.provider,
          model: pair.model,
          status: response.status,
          errText: lastError.errText.slice(0, 200),
        });
      } catch (fetchError) {
        lastError.status = 502;
        lastError.errText = fetchError instanceof Error ? fetchError.message : String(fetchError);
        console.warn("[ai-router] provider_error", {
          provider: pair.provider,
          model: pair.model,
          error: lastError.errText.slice(0, 200),
        });
      }
    }

    throw { status: lastError.status, errText: lastError.errText || "Todos os provedores de IA falharam." };
  }

  return { providers: configs.map((config) => config.id), call };
}
