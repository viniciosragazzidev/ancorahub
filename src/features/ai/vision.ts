import { generateText } from "ai";

import { getSystemSettings } from "@/features/system-settings/queries";

import { getAiEngineSettings } from "./engine";
import { getAiModelInstance } from "./providers";
import { defaultModels, type AiProvider, type AiSettings } from "./types";

/** Providers whose default models accept images. The Groq and OpenRouter defaults are text-only. */
const VISION_PROVIDERS: ReadonlySet<AiProvider> = new Set<AiProvider>(["google", "openai"]);

/** Thrown when no provider that can read images is available; callers record it instead of failing. */
export class VisionNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisionNotConfiguredError";
  }
}

export type VisionTarget = { provider: AiProvider; model: string };

function hasKey(settings: AiSettings, provider: AiProvider) {
  if (provider === "google") return Boolean(settings.googleApiKey || process.env.GOOGLE_API_KEY);
  if (provider === "openai") return Boolean(settings.openaiApiKey || process.env.OPENAI_API_KEY);
  return false;
}

/**
 * Picks the provider and model that read images: the explicit vision settings
 * first, then the primary or fallback provider when it accepts images, then
 * Google or OpenAI. Returns null when none of them has an API key.
 */
export function resolveVisionTarget(
  settings: AiSettings,
  vision: { provider?: string; model?: string },
): VisionTarget | null {
  const explicit = VISION_PROVIDERS.has(vision.provider as AiProvider) ? (vision.provider as AiProvider) : null;
  const fallback = settings.fallbackProvider === "none" ? null : settings.fallbackProvider;

  const candidates: AiProvider[] = [
    ...(explicit ? [explicit] : []),
    ...(VISION_PROVIDERS.has(settings.primaryProvider) ? [settings.primaryProvider] : []),
    ...(fallback && VISION_PROVIDERS.has(fallback) ? [fallback] : []),
    "google",
    "openai",
  ];

  const provider = candidates.find((candidate) => hasKey(settings, candidate));
  if (!provider) return null;

  // A model only travels with the provider it was configured for.
  const model =
    (provider === explicit ? vision.model?.trim() : "") ||
    (provider === settings.primaryProvider ? settings.primaryModel : "") ||
    (provider === fallback ? settings.fallbackModel : "") ||
    defaultModels[provider];

  return { provider, model };
}

/** Reads the text of an image with a vision model. Temperature 0: it transcribes, it does not interpret. */
export async function aiExtractImageText(params: {
  image: Uint8Array;
  mimeType: string;
  instruction: string;
  maxTokens?: number;
}) {
  const settings = await getAiEngineSettings();
  if (!settings.enabled) {
    throw new VisionNotConfiguredError("O motor de Inteligência Artificial está desativado pelo administrador.");
  }

  const rows = await getSystemSettings(["ai_vision_provider", "ai_vision_model"]);
  const values = new Map(rows.map((row) => [row.key, row.value ?? undefined]));
  const target = resolveVisionTarget(settings, {
    provider: values.get("ai_vision_provider"),
    model: values.get("ai_vision_model"),
  });
  if (!target) {
    throw new VisionNotConfiguredError("Nenhum provedor com leitura de imagem está configurado (Google ou OpenAI).");
  }

  const model = getAiModelInstance(target.provider, target.model, {
    googleKey: settings.googleApiKey,
    openaiKey: settings.openaiApiKey,
  });
  const result = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.instruction },
          { type: "image", image: params.image, mediaType: params.mimeType },
        ],
      },
    ],
    temperature: 0,
    maxOutputTokens: params.maxTokens ?? 2048,
  });

  return { text: result.text, provider: target.provider, model: target.model };
}
