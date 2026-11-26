import "server-only";

import { eq, gte, sql } from "drizzle-orm";

import { getSystemSetting, getSystemSettings } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import {
  aggregateUsage,
  credentialBadge,
  keyLast4,
  maskApiKey,
  PROFILE_LABEL,
  PROVIDER_LABEL,
  profileFallback,
  providerCheckSettingKey,
  readProviderCheck,
  shortFailureCause,
  type CredentialBadge,
  type ProviderCheck,
  type UsageGroupRow,
  type UsageSummaryRow,
} from "./admin-overview";
import { monthStartSaoPaulo } from "./anthropic-budget-domain";
import { providerKey } from "./gateway";
import { PROFILES, PROVIDERS, resolveChain, type AiProvider } from "./profiles";

export type ProviderCredentialRow = { provider: AiProvider; name: string; masked: string | null; source: "env" | "settings" | null; badge: CredentialBadge; checkedAt: string | null };
export type ProfileFallbackRow = { id: string; title: string; uses: string; primary: string; fallback: string };
export type AiAdminPanelData = {
  credentials: ProviderCredentialRow[];
  profiles: ProfileFallbackRow[];
  usage: UsageSummaryRow[] | null;
  monthLabel: string;
};

const ENV_KEY: Record<AiProvider, string> = {
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

/** Uso do mês por empresa, tipo de uso (coluna provider) e modelo, lido de ai_attendance_logs. */
async function loadUsage(monthStart: Date): Promise<UsageGroupRow[]> {
  const logs = schema.aiAttendanceLogs;
  const reported = sql`(${logs.estimatedCost} ~ '^[0-9]+(\\.[0-9]+)?([eE][-+]?[0-9]+)?$' and ${logs.estimatedCost}::numeric > 0)`;
  const rows = await getDatabase()
    .select({
      tenantId: logs.tenantId,
      tenantName: schema.tenants.name,
      purpose: logs.provider,
      model: logs.modelUsed,
      calls: sql<number>`count(*)::int`,
      tokens: sql<number>`coalesce(sum(${logs.totalTokens}), 0)::bigint`,
      reportedCostUsd: sql<number>`coalesce(sum(case when ${reported} then ${logs.estimatedCost}::numeric else 0 end), 0)::float8`,
      unpricedInputTokens: sql<number>`coalesce(sum(case when ${reported} then 0 else ${logs.promptTokens} end), 0)::bigint`,
      unpricedOutputTokens: sql<number>`coalesce(sum(case when ${reported} then 0 else ${logs.completionTokens} end), 0)::bigint`,
    })
    .from(logs)
    .leftJoin(schema.tenants, eq(schema.tenants.id, logs.tenantId))
    .where(sql`${gte(logs.createdAt, monthStart)} and ${logs.status} <> 'fallback'`)
    .groupBy(logs.tenantId, schema.tenants.name, logs.provider, logs.modelUsed);
  return rows.map((row) => ({
    ...row,
    calls: Number(row.calls),
    tokens: Number(row.tokens),
    reportedCostUsd: Number(row.reportedCostUsd),
    unpricedInputTokens: Number(row.unpricedInputTokens),
    unpricedOutputTokens: Number(row.unpricedOutputTokens),
  }));
}

export async function getAiAdminPanelData(now = new Date()): Promise<AiAdminPanelData> {
  const keys = new Map<AiProvider, string>();
  const sources = new Map<AiProvider, "env" | "settings">();
  for (const provider of PROVIDERS) {
    const key = await providerKey(provider);
    if (!key) continue;
    keys.set(provider, key);
    sources.set(provider, process.env[ENV_KEY[provider]]?.trim() ? "env" : "settings");
  }
  const [checks, overrides] = await Promise.all([
    getSystemSettings(PROVIDERS.map(providerCheckSettingKey)).catch(() => []),
    getSystemSetting("ai_gateway_profiles").then((value) => (value ? JSON.parse(value) : undefined)).catch(() => undefined),
  ]);
  const checkMap = new Map(checks.map((setting) => [setting.key, setting.value]));

  const credentials = PROVIDERS.map((provider) => {
    const key = keys.get(provider) ?? null;
    const check = readProviderCheck(checkMap.get(providerCheckSettingKey(provider)));
    return {
      provider,
      name: PROVIDER_LABEL[provider],
      masked: maskApiKey(key),
      source: sources.get(provider) ?? null,
      badge: credentialBadge({ key, check }),
      checkedAt: check && key && check.last4 === keyLast4(key) ? check.at : null,
    };
  });

  const profiles = PROFILES.map((profile) => {
    const chain = resolveChain(profile, { env: process.env, overrides, hasKey: (provider) => keys.has(provider) });
    return { id: profile, ...PROFILE_LABEL[profile], ...profileFallback(chain) };
  });

  const monthStart = monthStartSaoPaulo(now);
  const usage = await loadUsage(monthStart).then(aggregateUsage).catch((error) => {
    console.warn("[ai-admin] usage_failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return null;
  });
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" }).format(now);
  return { credentials, profiles, usage, monthLabel };
}

/** Endpoints sem custo de token: listar modelos (ou ler a própria chave, no OpenRouter) já prova a chave. */
function checkRequest(provider: AiProvider, key: string): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case "anthropic":
      return { url: "https://api.anthropic.com/v1/models?limit=1", headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } };
    case "openai":
      return { url: "https://api.openai.com/v1/models", headers: { Authorization: `Bearer ${key}` } };
    case "openrouter":
      return { url: "https://openrouter.ai/api/v1/key", headers: { Authorization: `Bearer ${key}` } };
    case "groq":
      return { url: "https://api.groq.com/openai/v1/models", headers: { Authorization: `Bearer ${key}` } };
    case "google":
      return { url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", headers: { "x-goog-api-key": key } };
  }
}

/** Testa a chave atual do provedor com uma chamada mínima e guarda o resultado (nunca a chave). */
export async function checkProviderCredential(provider: AiProvider, now = new Date(), fetcher: typeof fetch = fetch): Promise<ProviderCheck | null> {
  const key = await providerKey(provider);
  if (!key) return null;
  const request = checkRequest(provider, key);
  let check: ProviderCheck;
  try {
    const response = await fetcher(request.url, { method: "GET", headers: request.headers, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    check = response.ok
      ? { ok: true, at: now.toISOString(), last4: keyLast4(key) }
      : { ok: false, cause: shortFailureCause({ status: response.status }), at: now.toISOString(), last4: keyLast4(key) };
  } catch (error) {
    check = { ok: false, cause: shortFailureCause({ error }), at: now.toISOString(), last4: keyLast4(key) };
  }
  return check;
}
