import { monthKey, shiftMonth } from "./analytics-core";

export type MetricIntent = { metric: "production_count" | "production_value" | "implanted_count" | "cash_received" | "cancelled_count"; month: string; ambiguous: "confirmed" | null };

const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Deterministic: recognizes a small catalog of metric questions. Never builds queries from the text. */
export function parseMetricIntent(text: string, now: Date = new Date()): MetricIntent | null {
  const value = normalize(text).slice(0, 400);
  if (!/\b(quant[oa]s?|qual|quanto|total|numero|valor|resultado|producao|vendemos|vendi|vendeu|implant|recebe|recebid|confirmad|cancelad)/.test(value)) return null;
  let metric: MetricIntent["metric"] | null = null; let ambiguous: MetricIntent["ambiguous"] = null;
  if (/cancelad/.test(value) && /venda/.test(value)) metric = "cancelled_count";
  else if (/implant/.test(value)) metric = "implanted_count";
  else if (/(recebemos|recebid|recebimento|entrou no caixa|caixa)/.test(value)) metric = "cash_received";
  else if (/confirmad/.test(value)) { metric = "production_count"; ambiguous = "confirmed"; }
  else if (/(valor|faturamento|quanto vend|r\$)/.test(value) && /(venda|vend|producao)/.test(value)) metric = "production_value";
  else if (/(venda|vendemos|vendi|vendeu|producao|fechamentos?)/.test(value)) metric = "production_count";
  if (!metric) return null;
  const current = monthKey(now);
  let month = current;
  const explicit = /\b(20\d{2})-(0[1-9]|1[0-2])\b/.exec(value) ?? /\b(0[1-9]|1[0-2])\/(20\d{2})\b/.exec(value);
  const named = MONTHS.findIndex((name) => new RegExp(`\\b${name}\\b`).test(value));
  if (explicit) month = explicit[1].length === 4 ? `${explicit[1]}-${explicit[2]}` : `${explicit[2]}-${explicit[1]}`;
  else if (/mes passado|ultimo mes|mes anterior/.test(value)) month = shiftMonth(current, -1);
  else if (named >= 0) {
    const year = /\b(20\d{2})\b/.exec(value)?.[1];
    const candidate = `${year ?? current.slice(0, 4)}-${String(named + 1).padStart(2, "0")}`;
    month = !year && candidate > current ? `${Number(current.slice(0, 4)) - 1}-${candidate.slice(5)}` : candidate;
  }
  return { metric, month, ambiguous };
}
