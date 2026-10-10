/**
 * AI gateway: task profiles and the model chain of each one
 * (docs/implementations/active/2026-10-10-ia-assistentes-corretor.md §3.1).
 * Model names are configuration, never hard-wired: providers retire models
 * (llama-3.3-70b-versatile already returned model_not_found). Free first; a
 * paid entry only runs when its key exists.
 */
import { z } from "zod";

export const PROVIDERS = ["groq", "openrouter", "google", "openai", "anthropic"] as const;
export type AiProvider = (typeof PROVIDERS)[number];

export const PROFILES = ["chat-fast", "chat-smart", "json-structured", "long-context"] as const;
export type AiProfile = (typeof PROFILES)[number];

export type ModelRef = { provider: AiProvider; model: string };

/** OpenAI-compatible endpoints: one client for every provider. */
export const PROVIDER_ENDPOINT: Record<AiProvider, string> = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/chat/completions",
};

/** Env vars of each provider key (the gateway also reads the existing system_settings keys). */
export const PROVIDER_KEY_ENV: Record<AiProvider, string> = {
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** Free-tier providers may train on data: personal data is always masked before them. */
export const FREE_TIER_PROVIDERS: ReadonlySet<AiProvider> = new Set(["groq", "openrouter", "google"]);

type Env = Record<string, string | undefined>;

/** Defaults from env (Coolify), so swapping a retired model needs no deploy of code. */
export function defaultChains(env: Env): Record<AiProfile, ModelRef[]> {
  const groqFast = env.AI_GROQ_FAST_MODEL || "llama-3.1-8b-instant";
  const groqSmart = env.AI_GROQ_SMART_MODEL || env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const openrouterFree = env.AI_OPENROUTER_FREE_MODEL || "meta-llama/llama-3.3-70b-instruct:free";
  const gemini = env.AI_GEMINI_MODEL || "gemini-2.0-flash";
  const anthropic = env.AI_ANTHROPIC_MODEL || "claude-haiku-5-5";
  const openai = env.AI_OPENAI_MODEL || "gpt-4o-mini";
  const paid: ModelRef[] = [{ provider: "anthropic", model: anthropic }, { provider: "openai", model: openai }];
  return {
    "chat-fast": [{ provider: "groq", model: groqFast }, { provider: "groq", model: groqSmart }, { provider: "openrouter", model: openrouterFree }, ...paid],
    "chat-smart": [{ provider: "groq", model: groqSmart }, { provider: "google", model: gemini }, { provider: "openrouter", model: openrouterFree }, ...paid],
    "json-structured": [{ provider: "groq", model: groqSmart }, { provider: "google", model: gemini }, { provider: "openrouter", model: openrouterFree }, ...paid],
    "long-context": [{ provider: "google", model: gemini }, { provider: "groq", model: groqSmart }, { provider: "openrouter", model: openrouterFree }, ...paid],
  };
}

const modelRefSchema = z.object({ provider: z.enum(PROVIDERS), model: z.string().trim().min(1).max(120) });
/** Optional override saved by the super-admin (system_settings "ai_gateway_profiles", JSON). */
export const profileOverridesSchema = z.partialRecord(z.enum(PROFILES), z.array(modelRefSchema).min(1).max(8)).optional();

/** The chain of a profile: the override when valid, else the env defaults; only providers with a key. */
export function resolveChain(profile: AiProfile, input: { env: Env; overrides?: unknown; hasKey: (provider: AiProvider) => boolean }): ModelRef[] {
  const parsed = profileOverridesSchema.safeParse(input.overrides);
  const chain = (parsed.success && parsed.data?.[profile]) || defaultChains(input.env)[profile];
  const seen = new Set<string>();
  return chain.filter((ref) => {
    const key = `${ref.provider}:${ref.model}`;
    if (seen.has(key) || !input.hasKey(ref.provider)) return false;
    seen.add(key);
    return true;
  });
}
