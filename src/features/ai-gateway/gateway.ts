import "server-only";

import type { z } from "zod";

import { logAiUsage } from "@/features/ai-agent/ai-usage-log";
import { getSystemSetting } from "@/features/system-settings/queries";

import { FREE_TIER_PROVIDERS, PROVIDER_ENDPOINT, PROVIDER_KEY_ENV, resolveChain, type AiProfile, type AiProvider, type ModelRef } from "./profiles";
import { maskPersonalData } from "./privacy";

export type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

export type GatewayResult<T> =
  | { ok: true; value: T; text: string; model: ModelRef; attempts: number }
  | { ok: false; reason: "disabled" | "no_provider" | "rate_limited" | "all_failed"; attempts: number };

/** Keys already saved by the super-admin (plaintext today; F4 encrypts them). */
const SETTING_KEY: Record<AiProvider, string> = {
  groq: "ai_groq_api_key",
  openrouter: "ai_openrouter_api_key",
  google: "ai_google_api_key",
  openai: "ai_openai_api_key",
  anthropic: "ai_anthropic_api_key",
};

async function providerKey(provider: AiProvider) {
  const fromEnv = process.env[PROVIDER_KEY_ENV[provider]]?.trim();
  if (fromEnv) return fromEnv;
  return (await getSystemSetting(SETTING_KEY[provider]).catch(() => null))?.trim() || null;
}

/** Simple per-user limiter (in memory, per instance): protects the free quotas from a burst. */
const recent = new Map<string, number[]>();
const PER_MINUTE = 12;
function allow(user: string, now = Date.now()) {
  const list = (recent.get(user) ?? []).filter((at) => now - at < 60_000);
  if (list.length >= PER_MINUTE) { recent.set(user, list); return false; }
  list.push(now);
  recent.set(user, list);
  return true;
}

/** The first JSON object in a model answer (models sometimes wrap it in text or code fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

/**
 * The single way to call a model: profile -> chain of models (free first),
 * per-attempt timeout, fallback on any error or invalid output, personal data
 * masked for free tiers, usage logged with the real provider and model.
 */
export async function runGateway<T>(input: {
  profile: AiProfile;
  purpose: string;
  tenantId: string;
  userId: string;
  messages: GatewayMessage[];
  schema: z.ZodType<T>;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  leadId?: string | null;
  /** Client conversation or health data inside: only paid providers that do not train on it (LGPD art. 11). */
  sensitive?: boolean;
}): Promise<GatewayResult<T>> {
  if (!allow(`${input.tenantId}:${input.userId}`)) return { ok: false, reason: "rate_limited", attempts: 0 };

  const keys = new Map<AiProvider, string>();
  for (const provider of ["groq", "openrouter", "google", "openai", "anthropic"] as const) {
    const key = await providerKey(provider);
    if (key) keys.set(provider, key);
  }
  const overrides = await getSystemSetting("ai_gateway_profiles").then((value) => (value ? JSON.parse(value) : undefined)).catch(() => undefined);
  const chain = resolveChain(input.profile, { env: process.env, overrides, hasKey: (provider) => keys.has(provider) && !(input.sensitive && FREE_TIER_PROVIDERS.has(provider)) });
  if (!chain.length) return { ok: false, reason: "no_provider", attempts: 0 };

  let attempts = 0;
  for (const ref of chain) {
    attempts += 1;
    const startedAt = Date.now();
    const messages = FREE_TIER_PROVIDERS.has(ref.provider)
      ? input.messages.map((message) => ({ ...message, content: maskPersonalData(message.content) }))
      : input.messages;
    try {
      const response = await fetch(PROVIDER_ENDPOINT[ref.provider], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keys.get(ref.provider)}`,
          ...(ref.provider === "openrouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://crm.ancorasaude.cloud", "X-Title": "Ancora CRM" } : {}),
        },
        body: JSON.stringify({
          model: ref.model,
          messages,
          temperature: input.temperature ?? 0.3,
          max_tokens: input.maxTokens ?? 500,
          ...(ref.provider === "anthropic" ? {} : { response_format: { type: "json_object" } }),
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 12_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: Parameters<typeof logAiUsage>[0]["usage"] };
      const text = body.choices?.[0]?.message?.content ?? "";
      const parsed = input.schema.safeParse(extractJson(text));
      if (!parsed.success) throw new Error("invalid_output");
      void logAiUsage({ tenantId: input.tenantId, purpose: input.purpose, model: `${ref.provider}/${ref.model}`, startedAt, usage: body.usage ?? null, success: true, leadId: input.leadId ?? null });
      return { ok: true, value: parsed.data, text, model: ref, attempts };
    } catch (error) {
      void logAiUsage({ tenantId: input.tenantId, purpose: input.purpose, model: `${ref.provider}/${ref.model}`, startedAt, success: false, error: error instanceof Error ? error.message : "error", leadId: input.leadId ?? null });
    }
  }
  return { ok: false, reason: "all_failed", attempts };
}
