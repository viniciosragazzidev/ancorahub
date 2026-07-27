import { generateText } from "ai";
import { getSystemSettings } from "@/features/system-settings/queries";
import { getAiModelInstance } from "./providers";
import { defaultModels, type AiProvider, type AiSettings } from "./types";

export async function getAiEngineSettings(): Promise<AiSettings> {
  const settings = await getSystemSettings([
    "ai_enabled",
    "ai_primary_provider",
    "ai_primary_model",
    "ai_fallback_provider",
    "ai_fallback_model",
    "ai_temperature",
    "ai_max_tokens",
    "ai_system_prompt",
    "ai_groq_api_key",
    "ai_openai_api_key",
    "ai_google_api_key",
    "ai_openrouter_api_key",
  ]);

  const map = new Map(settings.map((s) => [s.key, s.value]));

  const enabled = map.get("ai_enabled") === "true";
  const primaryProvider = (map.get("ai_primary_provider") as AiProvider) || "groq";
  const primaryModel = map.get("ai_primary_model") || defaultModels[primaryProvider];
  const fallbackProvider = (map.get("ai_fallback_provider") as AiProvider | "none") || "none";
  const fallbackModel = map.get("ai_fallback_model") || (fallbackProvider !== "none" ? defaultModels[fallbackProvider] : "");
  const temperature = parseFloat(map.get("ai_temperature") ?? "0.7");
  const maxTokens = parseInt(map.get("ai_max_tokens") ?? "1024", 10);
  const systemPrompt = map.get("ai_system_prompt") ?? "Você é um assistente virtual utilitário e direto.";

  return {
    enabled,
    primaryProvider,
    primaryModel,
    fallbackProvider,
    fallbackModel,
    temperature,
    maxTokens,
    systemPrompt,
    groqApiKey: map.get("ai_groq_api_key"),
    openaiApiKey: map.get("ai_openai_api_key"),
    googleApiKey: map.get("ai_google_api_key"),
    openrouterApiKey: map.get("ai_openrouter_api_key"),
  };
}

export async function aiComplete(params: {
  userMessage: string;
  systemPromptOverride?: string;
  temperatureOverride?: number;
  maxTokensOverride?: number;
}) {
  const settings = await getAiEngineSettings();

  if (!settings.enabled) {
    throw new Error("O motor de Inteligência Artificial está desativado pelo administrador.");
  }

  const system = params.systemPromptOverride ?? settings.systemPrompt;
  const temperature = params.temperatureOverride ?? settings.temperature;
  const maxTokens = params.maxTokensOverride ?? settings.maxTokens;

  const keys = {
    groqKey: settings.groqApiKey,
    openaiKey: settings.openaiApiKey,
    googleKey: settings.googleApiKey,
    openrouterKey: settings.openrouterApiKey,
  };

  // 1. Try Primary
  try {
    const primaryModel = getAiModelInstance(settings.primaryProvider, settings.primaryModel, keys);
    const result = await generateText({
      model: primaryModel,
      system,
      prompt: params.userMessage,
      temperature,
      maxOutputTokens: maxTokens,
    });

    return {
      text: result.text,
      provider: settings.primaryProvider,
      model: settings.primaryModel,
    };
  } catch (primaryError) {
    console.error(`[AI Engine] Falha no provedor primário (${settings.primaryProvider}):`, primaryError);

    // 2. Try Fallback if configured
    if (settings.fallbackProvider && settings.fallbackProvider !== "none") {
      try {
        const fallbackModel = getAiModelInstance(settings.fallbackProvider, settings.fallbackModel, keys);
        const result = await generateText({
          model: fallbackModel,
          system,
          prompt: params.userMessage,
          temperature,
          maxOutputTokens: maxTokens,
        });

        return {
          text: result.text,
          provider: settings.fallbackProvider,
          model: settings.fallbackModel,
          isFallbackUsed: true,
        };
      } catch (fallbackError) {
        console.error(`[AI Engine] Falha no provedor de fallback (${settings.fallbackProvider}):`, fallbackError);
        throw new Error(`Todos os provedores de IA falharam. Erro original: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
      }
    }

    throw primaryError;
  }
}
