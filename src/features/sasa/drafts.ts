/**
 * Rascunhos que o Sasá passa para as conversas guiadas (fase 4): "fechou a venda do Carlos, Amil S380, 3 vidas,
 * 35, 32 e 8, R$ 1.290" abre o registro da venda já preenchido; "cotação para 3 vidas, 35, 32 e 8" abre a cotação
 * com as idades. O servidor só extrai números e palavras; quem casa operadora, plano e cidade é a tela, com o
 * catálogo dela. O rascunho viaja no aparelho (sessionStorage, 10 min), nunca na URL.
 */
import { parseWhenPtBr, normalizePtBr } from "./parse-when";

export type SalePlanTypeDraft = "individual" | "familiar" | "pme" | "empresarial";
export type SaleSpokenDraft = {
  /** A frase inteira: a tela procura nela a operadora e o plano do catálogo. */
  text: string;
  planType?: SalePlanTypeDraft;
  ages?: number[];
  monthlyValue?: number;
  /** AAAA-MM-DD */
  coverageStartDate?: string;
};

export type QuoteAudienceDraft = "PESSOA_FISICA" | "ADESAO" | "PME_EMPRESARIAL";
export type QuoteSpokenDraft = { text: string; ages?: number[]; audience?: QuoteAudienceDraft; kind?: "saude" | "odonto" };

export type SasaOpen =
  | { kind: "sale"; leadId: string; href: string; draft: SaleSpokenDraft }
  | { kind: "quote"; href: string; draft: QuoteSpokenDraft };

/** "35, 32 e 8 anos", "idades 35, 32 e 8", "de 40 anos": só números ditos como idade. */
export function spokenAges(input: string): number[] | undefined {
  const text = normalizePtBr(input);
  const list = "((?:\\d{1,3}\\s*(?:,|e)\\s*)*\\d{1,3})";
  const match = text.match(new RegExp(`${list}\\s*anos`)) ?? text.match(new RegExp(`idades?\\s*(?:de|:)?\\s*${list}`)) ?? text.match(new RegExp(`vidas?\\s*(?:,|:|-)?\\s*(?:de\\s*)?${list}(?!\\s*(?:reais|mil|h\\b|:))`));
  if (!match) return undefined;
  const ages = match[1]!.split(/\s*(?:,|e)\s*/).map(Number).filter((age) => Number.isInteger(age) && age >= 0 && age <= 120);
  return ages.length ? ages.slice(0, 30) : undefined;
}

/** "R$ 1.290", "1.290,50 reais", "1290 por mês". */
export function spokenMoney(input: string): number | undefined {
  const text = normalizePtBr(input);
  const match = text.match(/r\$\s*([\d.]+(?:,\d{1,2})?)/) ?? text.match(/([\d.]+(?:,\d{1,2})?)\s*(?:reais|por mes|mensais|de mensalidade)/);
  if (!match) return undefined;
  const value = Number(match[1]!.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= 1_000_000 ? Math.round(value * 100) / 100 : undefined;
}

function spokenPlanType(text: string): SalePlanTypeDraft | undefined {
  if (/\bempresarial\b/.test(text)) return "empresarial";
  if (/\b(pme|cnpj|mei|empresa)\b/.test(text)) return "pme";
  if (/\bfamiliar\b/.test(text)) return "familiar";
  if (/\bindividual\b/.test(text)) return "individual";
  return undefined;
}

export function parseSpokenSale(input: string, now: Date): SaleSpokenDraft {
  const text = normalizePtBr(input);
  const draft: SaleSpokenDraft = { text: input.slice(0, 500) };
  const planType = spokenPlanType(text);
  if (planType) draft.planType = planType;
  const ages = spokenAges(input);
  if (ages) draft.ages = ages;
  const value = spokenMoney(input);
  if (value) draft.monthlyValue = value;
  const start = text.match(/\b(?:vigencia|comeca|comecando|inicio|inicia|a partir)\b(.{0,30})/);
  const at = start ? parseWhenPtBr(start[1]!.replace(/\b1o\b|\bprimeiro\b/, "1"), now) : null;
  if (at) {
    const shifted = new Date(at.at.getTime() - 3 * 3_600_000);
    draft.coverageStartDate = shifted.toISOString().slice(0, 10);
  }
  return draft;
}

export function parseSpokenQuote(input: string): QuoteSpokenDraft {
  const text = normalizePtBr(input);
  const draft: QuoteSpokenDraft = { text: input.slice(0, 500) };
  const ages = spokenAges(input);
  if (ages) draft.ages = ages;
  if (/\b(odonto|dental|dentario)\b/.test(text)) draft.kind = "odonto";
  else draft.kind = "saude";
  if (/\b(pme|cnpj|mei|empresa|empresarial)\b/.test(text)) draft.audience = "PME_EMPRESARIAL";
  else if (/\b(adesao|entidade|sindicato|conselho)\b/.test(text)) draft.audience = "ADESAO";
  else if (/\b(pessoa fisica|individual|familiar|cpf)\b/.test(text)) draft.audience = "PESSOA_FISICA";
  return draft;
}

/** Item do catálogo dito na frase, com palavra inteira ("Amil" não casa dentro de "familiar"); o mais longo vence. */
export function mentionedIn<T extends { name: string }>(items: readonly T[], text: string): T | null {
  const spoken = ` ${normalizePtBr(text).replace(/[^a-z0-9]+/g, " ").trim()} `;
  let best: T | null = null;
  let bestLength = 0;
  for (const item of items) {
    const own = normalizePtBr(item.name).replace(/[^a-z0-9]+/g, " ").trim();
    if (own.length >= 3 && spoken.includes(` ${own} `) && own.length > bestLength) { best = item; bestLength = own.length; }
  }
  return best;
}

/* ---------- No aparelho: guardado pelo Sasá, lido uma vez pela tela ---------- */

const TTL_MS = 10 * 60_000;
const saleKey = (leadId: string) => `sasa:sale:${leadId}`;
const QUOTE_KEY = "sasa:quote";

function put(key: string, value: unknown) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); } catch { /* sem armazenamento: abre vazio */ }
}

function take<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    window.sessionStorage.removeItem(key);
    const data = JSON.parse(raw) as { at?: number; value?: T };
    return data.at && Date.now() - data.at <= TTL_MS && data.value ? data.value : null;
  } catch {
    return null;
  }
}

export function keepSasaOpen(open: SasaOpen) {
  if (open.kind === "sale") put(saleKey(open.leadId), open.draft);
  else put(QUOTE_KEY, open.draft);
}

export function takeSaleDraft(leadId: string) {
  return take<SaleSpokenDraft>(saleKey(leadId));
}

export function takeQuoteDraft() {
  return take<QuoteSpokenDraft>(QUOTE_KEY);
}
