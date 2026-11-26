/**
 * Painel da IA no Super-admin (26/11): regras puras de exibição.
 * Mascarar a chave (só os 4 últimos), traduzir o teste do provedor em selo, ler a reserva de cada perfil
 * da cadeia que o gateway já usa e somar o uso do mês por empresa e tipo de uso. Sem banco, sem segredo.
 */
import { anthropicCostUsd } from "./anthropic-budget-domain";
import type { AiProfile, AiProvider, ModelRef } from "./profiles";

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  groq: "Groq",
  google: "Google",
};

/** Nunca a chave inteira: só os 4 últimos caracteres. Chave curta demais não mostra nada dela. */
export function maskApiKey(key: string | null | undefined): string | null {
  const value = String(key ?? "").trim();
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return `•••• ${value.slice(-4)}`;
}

/** Resultado salvo do último "Testar agora" (system_settings `ai_provider_check_<provedor>`). */
export type ProviderCheck = { ok: boolean; cause?: string; at: string; last4: string };

export const providerCheckSettingKey = (provider: AiProvider) => `ai_provider_check_${provider}`;

export function readProviderCheck(value: string | null | undefined): ProviderCheck | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<ProviderCheck>;
    if (typeof parsed.ok !== "boolean" || typeof parsed.at !== "string" || typeof parsed.last4 !== "string") return null;
    return { ok: parsed.ok, at: parsed.at, last4: parsed.last4, cause: typeof parsed.cause === "string" ? parsed.cause : undefined };
  } catch {
    return null;
  }
}

export const keyLast4 = (key: string) => key.trim().slice(-4);

export type CredentialBadge = { tone: "success" | "danger" | undefined; label: string };

/**
 * Selo por provedor. O teste vale só para a chave testada: se a chave mudou depois (outros 4 últimos),
 * volta a "Não testada".
 */
export function credentialBadge(input: { key: string | null; check: ProviderCheck | null }): CredentialBadge {
  if (!input.key) return { tone: undefined, label: "Sem chave" };
  const check = input.check;
  if (!check || check.last4 !== keyLast4(input.key)) return { tone: undefined, label: "Não testada" };
  if (check.ok) return { tone: "success", label: "Validada" };
  return { tone: "danger", label: `Falhou: ${check.cause || "erro inesperado"}` };
}

/** Causa curta do teste que falhou, a partir do status HTTP ou do erro de rede. */
export function shortFailureCause(input: { status?: number; error?: unknown }): string {
  const status = input.status;
  if (status === 401 || status === 403) return "chave recusada";
  if (status === 402) return "sem crédito";
  if (status === 429) return "limite de uso";
  if (status === 404) return "endereço não encontrado";
  if (status && status >= 500) return "provedor fora do ar";
  if (status && status >= 400) return `erro ${status}`;
  const error = input.error;
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError" || name === "AbortError") return "sem resposta";
  if (error) return "sem conexão";
  return "erro inesperado";
}

export const PROFILE_LABEL: Record<AiProfile, { title: string; uses: string }> = {
  interpreter: { title: "Qualificação", uses: "Robô de qualificação no WhatsApp, resposta lateral, Venda Automatizada e pós-venda" },
  "chat-fast": { title: "Respostas rápidas", uses: "Comandos do Sasá, Plantão, Agenda, Cotação e Desempenho" },
  "chat-smart": { title: "Sugestões e Sasá", uses: "Perguntas ao Sasá, Leads, Dicas de Atendimento, Conversa do lead e catálogo de operadoras" },
  "json-structured": { title: "Análise estruturada", uses: "Análise das conversas, catálogo de operadoras, comprovantes e lista do supervisor" },
  "long-context": { title: "Textos longos", uses: "Leituras com muito contexto" },
};

export const modelRefLabel = (ref: ModelRef) => `${PROVIDER_LABEL[ref.provider]} · ${ref.model}`;

/** O que o perfil usa e o que entra se o primeiro falhar, lendo a cadeia já resolvida (só provedores com chave). */
export function profileFallback(chain: ModelRef[]): { primary: string; fallback: string } {
  return {
    primary: chain[0] ? modelRefLabel(chain[0]) : "Sem provedor com chave",
    fallback: chain[1] ? `Se falhar: ${modelRefLabel(chain[1])}` : "Sem reserva",
  };
}

/** Uma linha agrupada do banco: empresa, tipo de uso (coluna provider do log) e modelo, no mês. */
export type UsageGroupRow = {
  tenantId: string;
  tenantName: string | null;
  purpose: string;
  model: string;
  calls: number;
  tokens: number;
  /** Soma do custo que o provedor informou. */
  reportedCostUsd: number;
  /** Tokens das chamadas sem custo informado (entram a preço de tabela quando o modelo é Claude). */
  unpricedInputTokens: number;
  unpricedOutputTokens: number;
};

export type UsageSummaryRow = {
  id: string;
  tenantName: string;
  purpose: string;
  purposeLabel: string;
  calls: number;
  tokens: number;
  costUsd: number;
};

/** Linhas que não são chamada a modelo: regra determinística e o registro de "a regra assumiu". */
const NOT_A_MODEL_CALL = /^deterministic/;

const PURPOSE_LABEL: Record<string, string> = {
  openrouter: "Qualificação no WhatsApp",
  lateral_answer: "Resposta lateral",
  qualification_fallback: "Qualificação (reserva)",
  qualification_verification: "Qualificação (conferência)",
  qualification_context_analysis: "Qualificação (contexto)",
  audio_transcription: "Transcrição de áudio",
  conversation_intelligence: "Análise das conversas",
  sasa_agent: "Sasá",
  sasa_command: "Sasá (comandos)",
  sasa_voice: "Sasá (voz)",
  broker_assistant: "Assistentes do corretor",
  agent_director: "Agente do diretor",
  auto_sale_turn: "Venda Automatizada",
  auto_sale_audio: "Venda Automatizada (áudio)",
  post_sale_interpretation: "Pós-venda",
  payment_proof_validator: "Comprovantes",
  operator_catalog_extract: "Catálogo de operadoras",
  supervisor_list_structure: "Lista do supervisor",
  cotacao_express: "Cotação expressa",
};

export function purposeLabel(purpose: string) {
  if (PURPOSE_LABEL[purpose]) return PURPOSE_LABEL[purpose];
  if (purpose.startsWith("broker_assistant")) return "Assistentes do corretor";
  const text = purpose.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Sem tipo";
}

const isClaude = (model: string) => /^(anthropic\/)?claude/.test(model);

/** Custo estimado de um grupo: o que o provedor informou mais os tokens do Claude sem custo, a preço de tabela. */
export function usageGroupCostUsd(row: Pick<UsageGroupRow, "model" | "reportedCostUsd" | "unpricedInputTokens" | "unpricedOutputTokens">) {
  const listed = isClaude(row.model) ? anthropicCostUsd(row.model.replace(/^anthropic\//, "").replace(/\./g, "-"), row.unpricedInputTokens, row.unpricedOutputTokens) : 0;
  return Math.max(0, row.reportedCostUsd) + listed;
}

/** Soma por empresa e tipo de uso (os modelos se juntam), maior custo primeiro. */
export function aggregateUsage(rows: UsageGroupRow[]): UsageSummaryRow[] {
  const byKey = new Map<string, UsageSummaryRow>();
  for (const row of rows) {
    if (NOT_A_MODEL_CALL.test(row.purpose)) continue;
    const id = `${row.tenantId}:${row.purpose}`;
    const current = byKey.get(id) ?? {
      id,
      tenantName: row.tenantName || "Empresa sem nome",
      purpose: row.purpose,
      purposeLabel: purposeLabel(row.purpose),
      calls: 0,
      tokens: 0,
      costUsd: 0,
    };
    current.calls += Math.max(0, row.calls);
    current.tokens += Math.max(0, row.tokens);
    current.costUsd += usageGroupCostUsd(row);
    byKey.set(id, current);
  }
  return [...byKey.values()].sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls || a.tenantName.localeCompare(b.tenantName, "pt-BR"));
}

export function usageTotals(rows: UsageSummaryRow[]) {
  return rows.reduce((total, row) => ({ calls: total.calls + row.calls, tokens: total.tokens + row.tokens, costUsd: total.costUsd + row.costUsd }), { calls: 0, tokens: 0, costUsd: 0 });
}
