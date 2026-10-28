/** Monthly budget of the Anthropic API credit, in US dollars (Super-admin › IA; 100 by default, 28/10). */
export const AI_BUDGET_SETTING = "ai_anthropic_monthly_budget_usd";
export const DEFAULT_AI_BUDGET_USD = 100;
/** From this share of the budget the directors get a warning (once a month). */
export const AI_BUDGET_WARNING_RATIO = 0.8;

/**
 * Anthropic first-party prices, US$ per million tokens (October 2026; Haiku up to 100K-token
 * prompts). A Claude model not listed counts at the Haiku 5.5 price, the one the CRM uses.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.10, output: 0.50 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

/** Cost of one model's tokens; `model` as logged ("anthropic/claude-haiku-5-5") or bare. */
export function anthropicCostUsd(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICES[model.replace(/^anthropic\//, "")] ?? PRICES["claude-haiku-5-5"];
  return (Math.max(0, inputTokens) * price.input + Math.max(0, outputTokens) * price.output) / 1_000_000;
}

export function readBudgetUsd(value: string | null | undefined) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_AI_BUDGET_USD;
}

export type AiBudgetLevel = "ok" | "warning" | "exceeded";

export function aiBudgetLevel(spentUsd: number, budgetUsd: number): AiBudgetLevel {
  if (spentUsd >= budgetUsd) return "exceeded";
  return spentUsd >= budgetUsd * AI_BUDGET_WARNING_RATIO ? "warning" : "ok";
}

/** 00:00 of the first day of the month in São Paulo (the credit is spent by the Brazilian operation). */
export function monthStartSaoPaulo(now: Date) {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" })
    .format(now).split("-").map(Number);
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00-03:00`);
}

/** "2026-10": one warning per month. */
export function budgetMonthKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(now);
}
