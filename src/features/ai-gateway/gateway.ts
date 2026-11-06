import "server-only";

import { toJSONSchema, type z } from "zod";

import { logAiUsage } from "@/features/ai-agent/ai-usage-log";
import { getSystemSetting } from "@/features/system-settings/queries";

import { ANTHROPIC_MESSAGES_ENDPOINT, PROVIDER_ENDPOINT, PROVIDER_KEY_ENV, isFreeTier, resolveChain, type AiProfile, type AiProvider, type ModelRef } from "./profiles";
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

const PROVIDER_COOLDOWN_MS = 10 * 60_000;
const providerCooldowns = new Map<string, { until: number; status: 401 | 402 }>();

/** @internal Isolates cooldown state between gateway contract tests. */
export function resetProviderCooldownsForTests() {
  providerCooldowns.clear();
}

class ProviderHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ProviderHttpError";
  }
}

function providerCooldownKey(ref: ModelRef) {
  return `${ref.provider}:${isFreeTier(ref) ? "free" : "paid"}`;
}

function providerIsCoolingDown(ref: ModelRef, now = Date.now()) {
  const key = providerCooldownKey(ref);
  const cooldown = providerCooldowns.get(key);
  if (!cooldown) return false;
  if (cooldown.until <= now) {
    providerCooldowns.delete(key);
    return false;
  }
  return true;
}

function anthropicSchema(schema: z.ZodType<unknown>) {
  const raw = toJSONSchema(schema, { unrepresentable: "any" }) as Record<string, unknown>;
  const unsupported = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "maxItems"]);
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (unsupported.has(key)) continue;
      if (key === "minItems" && typeof child === "number" && child > 1) continue;
      output[key] = clean(child);
    }
    return output;
  };
  return clean(raw);
}

export function buildAnthropicMessagesRequest(input: {
  model: string;
  messages: GatewayMessage[];
  maxTokens: number;
  schema: z.ZodType<unknown>;
}) {
  const system = input.messages.filter((message) => message.role === "system").map((message) => message.content).filter(Boolean).join("\n\n");
  const turns = input.messages.filter((message) => message.role !== "system");
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of turns) {
    const role = message.role as "user" | "assistant";
    const previous = messages[messages.length - 1];
    if (previous?.role === role) previous.content += `\n\n${message.content}`;
    else messages.push({ role, content: message.content });
  }
  // Messages API requires a user turn first. Older context before the first customer turn
  // has no bearing on the current answer and is safely omitted.
  while (messages[0]?.role === "assistant") messages.shift();
  if (!messages.length) messages.push({ role: "user", content: "Responda ao pedido usando o formato JSON definido." });

  return {
    model: input.model,
    max_tokens: input.maxTokens,
    ...(system ? { system } : {}),
    messages,
    ...(input.model.includes("haiku-5-5") ? { thinking: { type: "disabled" } } : {}),
    output_config: { format: { type: "json_schema", schema: anthropicSchema(input.schema) } },
  };
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
  /** Maximum paid model calls before the caller's deterministic fallback. 401/402 do not consume a call. */
  maxAttempts?: number;
  /** Total wall-clock budget across all provider attempts. Interpreter calls default to 12 seconds. */
  totalTimeoutMs?: number;
  /** Retry direct Claude Haiku 5.5 once for malformed/empty output or timeout before fallback. */
  retryAnthropicHaikuOnTransient?: boolean;
  /** Client conversation or health data inside: only paid providers that do not train on it (LGPD art. 11). */
  sensitive?: boolean;
  /**
   * Mask phones, e-mails, CPFs and boleto lines for every provider, paid ones
   * included. For tasks that never need those values (analysis, summaries):
   * data minimisation, LGPD art. 6 III. Free tiers are always masked.
   */
  maskPersonalData?: boolean;
}): Promise<GatewayResult<T>> {
  const totalTimeoutMs = input.totalTimeoutMs ?? (input.profile === "interpreter" ? 12_000 : undefined);
  const totalDeadlineAt = totalTimeoutMs && totalTimeoutMs > 0 ? Date.now() + totalTimeoutMs : undefined;
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
  const maxAttempts = input.maxAttempts && input.maxAttempts > 0 ? input.maxAttempts : chain.length;
  for (const ref of chain) {
    if (totalDeadlineAt !== undefined && Date.now() >= totalDeadlineAt) {
      lastError = `total deadline exceeded (${totalTimeoutMs}ms)`;
      break;
    }
    if (providerIsCoolingDown(ref)) {
      const cooldown = providerCooldowns.get(providerCooldownKey(ref));
      lastError = `${ref.provider}: temporarily disabled after HTTP ${cooldown?.status ?? 401}`;
      continue;
    }
    const retryHaiku = input.retryAnthropicHaikuOnTransient === true && ref.provider === "anthropic" && ref.model.includes("haiku-5-5");
    for (let providerAttempt = 0; providerAttempt < (retryHaiku ? 2 : 1); providerAttempt += 1) {
      if (attempts >= maxAttempts) break;
      const remainingTotalMs = totalDeadlineAt === undefined ? undefined : totalDeadlineAt - Date.now();
      if (remainingTotalMs !== undefined && remainingTotalMs <= 0) {
        lastError = `total deadline exceeded (${totalTimeoutMs}ms)`;
        break;
      }
      const attemptTimeoutMs = Math.max(1, Math.min(input.timeoutMs ?? 12_000, remainingTotalMs ?? Number.POSITIVE_INFINITY));
      const startedAt = Date.now();
      attempts += 1;
      const nativeAnthropic = ref.provider === "anthropic" && input.profile === "interpreter";
      const messages = input.maskPersonalData || isFreeTier(ref)
        ? input.messages.map((message) => ({ ...message, content: maskPersonalData(message.content) }))
        : input.messages;
    try {
      const response = await fetch(nativeAnthropic ? ANTHROPIC_MESSAGES_ENDPOINT : PROVIDER_ENDPOINT[ref.provider], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(nativeAnthropic
            ? { "x-api-key": keys.get(ref.provider)!, "anthropic-version": "2023-06-01" }
            : { Authorization: `Bearer ${keys.get(ref.provider)}` }),
          ...(ref.provider === "openrouter" ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://crm.ancorasaude.cloud", "X-Title": "Ancora CRM" } : {}),
        },
        body: JSON.stringify(nativeAnthropic ? buildAnthropicMessagesRequest({
          model: ref.model,
          messages,
          maxTokens: input.maxTokens ?? 500,
          schema: input.schema,
        }) : {
          model: ref.model,
          messages,
          // Claude Haiku 5.5 refuses `temperature` even on its compatibility endpoint.
          ...(ref.provider === "anthropic" ? {} : { temperature: input.temperature ?? 0.3 }),
          max_tokens: input.maxTokens ?? 500,
          ...(ref.provider === "anthropic" ? {} : { response_format: { type: "json_object" } }),
          // LGPD: paid OpenRouter calls only go to providers that neither keep nor train on the data
          // (same rule as withNoDataCollection in features/ai/providers.ts, for the AI SDK clients).
          ...(ref.provider === "openrouter" && !isFreeTier(ref) ? { provider: { data_collection: "deny" } } : {}),
          // gpt-oss thinks before answering: low effort keeps the answer inside max_tokens and fast.
          ...(ref.model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
        }),
        signal: AbortSignal.timeout(attemptTimeoutMs),
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
        throw new ProviderHttpError(response.status, `HTTP ${response.status}${detail ? ` ${detail}` : ""}`);
      }
      const body = await response.json() as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string | null;
        usage?: (NonNullable<Parameters<typeof logAiUsage>[0]["usage"]> & { input_tokens?: number; output_tokens?: number }) | null;
      };
      const finishReason = nativeAnthropic ? body.stop_reason : body.choices?.[0]?.finish_reason;
      const text = nativeAnthropic
        ? (body.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n")
        : body.choices?.[0]?.message?.content ?? "";
      const parsed = input.schema.safeParse(extractJson(text));
      // The reason without the content (it may carry client data): cut by max_tokens or not JSON.
      if (!parsed.success) throw new Error(`invalid_output (${finishReason ?? "?"}, ${text.length} chars)`);
      const usage = nativeAnthropic && body.usage ? {
        prompt_tokens: body.usage.input_tokens,
        completion_tokens: body.usage.output_tokens,
        total_tokens: (body.usage.input_tokens ?? 0) + (body.usage.output_tokens ?? 0),
      } : body.usage ?? null;
      void logAiUsage({ ...log, model: `${ref.provider}/${ref.model}`, startedAt, usage, success: true });
      return { ok: true, value: parsed.data, text, model: ref, attempts };
    } catch (error) {
      const message = error instanceof Error ? (error.name === "TimeoutError" ? `timeout ${attemptTimeoutMs}ms` : error.message) : "error";
      lastError = `${ref.provider}/${ref.model}: ${message}`;
      void logAiUsage({ ...log, model: `${ref.provider}/${ref.model}`, startedAt, success: false, error: message });
      if (error instanceof ProviderHttpError && (error.status === 401 || error.status === 402)) {
        // Auth/billing failures are provider/tier health, not model attempts. A paid OpenRouter
        // failure must not disable :free models in profiles that can use those models.
        attempts -= 1;
        providerCooldowns.set(providerCooldownKey(ref), { until: Date.now() + PROVIDER_COOLDOWN_MS, status: error.status });
        break;
      }
      const isTransientHaikuFailure = retryHaiku
        && providerAttempt === 0
        && (error instanceof Error && (error.name === "TimeoutError" || /^invalid_output\s*\(/.test(error.message)));
      if (!isTransientHaikuFailure) break;
    }
    }
    if (attempts >= maxAttempts) break;
  }
  return { ok: false, reason: "all_failed", attempts, lastError };
}
