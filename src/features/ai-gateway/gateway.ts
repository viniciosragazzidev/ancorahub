import "server-only";

import type { z } from "zod";

import { logAiUsage } from "@/features/ai-agent/ai-usage-log";
import { getSystemSetting } from "@/features/system-settings/queries";

import { PROVIDER_ENDPOINT, PROVIDER_KEY_ENV, isFreeTier, resolveChain, type AiProfile, type AiProvider, type ModelRef } from "./profiles";
import { maskPersonalData } from "./privacy";

export type GatewayMessage = { role: "system" | "user" | "assistant"; content: string };

export type GatewayResult<T> =
  | { ok: true; value: T; text: string; model: ModelRef; attempts: number }
  | { ok: false; reason: "disabled" | "no_provider" | "rate_limited" | "all_failed"; attempts: number; lastError?: string };

/** Keys already saved by the super-admin (plaintext today; F4 encrypts them). */
const SETTING_KEY: Record<AiProvider, string> = {
  groq: "ai_groq_api_key",
  openrouter: "ai_openrouter_api_key",
  google: "ai_google_api_key",
  openai: "ai_openai_api_key",
  anthropic: "ai_anthropic_api_key",
};

export async function providerKey(provider: AiProvider) {
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

/**
 * The JSON object in a model answer. Models sometimes wrap it in code fences or write a line
 * before or after it, sometimes with braces of their own (24/10, Claude direct): the whole
 * span is tried first, then each balanced object from the first brace on.
 */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  for (let open = start; open >= 0 && open < text.length; open = text.indexOf("{", open + 1)) {
    let depth = 0;
    let inString = false;
    for (let index = open; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (char === "\\") index += 1;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        try { return JSON.parse(text.slice(open, index + 1)); } catch { break; }
      }
    }
  }
  return null;
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
  conversationId?: string | null;
  sourceMessageId?: string | null;
  /** Stop after this many models (the caller is inside a customer's turn and has a fallback). */
  maxAttempts?: number;
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
  // Sensitive (client conversation): only paid models, which do not train on the data (LGPD art. 11).
  const chain = resolveChain(input.profile, { env: process.env, overrides, hasKey: (provider) => keys.has(provider), allow: (ref) => !(input.sensitive && isFreeTier(ref)) });
  if (!chain.length) return { ok: false, reason: "no_provider", attempts: 0 };

  let attempts = 0;
  let lastError: string | undefined;
  const log = { tenantId: input.tenantId, purpose: input.purpose, leadId: input.leadId ?? null, conversationId: input.conversationId ?? null, sourceMessageId: input.sourceMessageId ?? null };
  for (const ref of chain.slice(0, input.maxAttempts && input.maxAttempts > 0 ? input.maxAttempts : chain.length)) {
    attempts += 1;
    const startedAt = Date.now();
    const messages = isFreeTier(ref)
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
          // Claude Haiku 5.5 direct refuses `temperature` (HTTP 400 "deprecated for this model", 24/10).
          ...(ref.provider === "anthropic" ? {} : { temperature: input.temperature ?? 0.3 }),
          max_tokens: input.maxTokens ?? 500,
          ...(ref.provider === "anthropic" ? {} : { response_format: { type: "json_object" } }),
          // LGPD: paid OpenRouter calls only go to providers that neither keep nor train on the data
          // (same rule as withNoDataCollection in features/ai/providers.ts, for the AI SDK clients).
          ...(ref.provider === "openrouter" && !isFreeTier(ref) ? { provider: { data_collection: "deny" } } : {}),
          // gpt-oss thinks before answering: low effort keeps the answer inside max_tokens and fast.
          ...(ref.model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 12_000),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
        throw new Error(`HTTP ${response.status}${detail ? ` ${detail}` : ""}`);
      }
      const body = await response.json() as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }>; usage?: Parameters<typeof logAiUsage>[0]["usage"] };
      const text = body.choices?.[0]?.message?.content ?? "";
      const parsed = input.schema.safeParse(extractJson(text));
      // The reason without the content (it may carry client data): cut by max_tokens or not JSON.
      if (!parsed.success) throw new Error(`invalid_output (${body.choices?.[0]?.finish_reason ?? "?"}, ${text.length} chars)`);
      void logAiUsage({ ...log, model: `${ref.provider}/${ref.model}`, startedAt, usage: body.usage ?? null, success: true });
      return { ok: true, value: parsed.data, text, model: ref, attempts };
    } catch (error) {
      const message = error instanceof Error ? (error.name === "TimeoutError" ? `timeout ${input.timeoutMs ?? 12_000}ms` : error.message) : "error";
      lastError = `${ref.provider}/${ref.model}: ${message}`;
      void logAiUsage({ ...log, model: `${ref.provider}/${ref.model}`, startedAt, success: false, error: message });
    }
  }
  return { ok: false, reason: "all_failed", attempts, lastError };
}
