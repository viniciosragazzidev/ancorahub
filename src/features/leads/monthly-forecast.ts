/**
 * Previsão do mês no funil (26/11/2026): soma do valor mensal das vendas abertas ponderado pela chance de cada etapa.
 * Lead sem valor (nem na proposta, nem no lead) fica de fora e é contado à parte. Somas em centavos exatos.
 * As chances ficam por empresa em system_settings (`lead_forecast_stage_chances_<tenantId>`, JSON); sem a chave,
 * valem as padrão abaixo.
 */

export type ForecastStage = { status: string; label: string; defaultChance: number };

/** Etapas abertas do funil, na ordem do avanço. Novo e distribuído ainda não são venda em andamento. */
export const FORECAST_STAGES: readonly ForecastStage[] = [
  { status: "in_contact", label: "Em atendimento", defaultChance: 5 },
  { status: "contacted", label: "Entrei em contato", defaultChance: 10 },
  { status: "quote_sent", label: "Cotação enviada", defaultChance: 20 },
  { status: "awaiting_reply", label: "Aguardando retorno", defaultChance: 30 },
  { status: "negotiation", label: "Negociação", defaultChance: 50 },
  { status: "documentation_pending", label: "Documentação pendente", defaultChance: 70 },
  { status: "under_analysis", label: "Em análise na operadora", defaultChance: 85 },
];

export const FORECAST_STATUSES = FORECAST_STAGES.map((stage) => stage.status);

export type ForecastChances = Record<string, number>;

export function forecastChancesKey(tenantId: string) {
  return `lead_forecast_stage_chances_${tenantId}`;
}

export function defaultForecastChances(): ForecastChances {
  return Object.fromEntries(FORECAST_STAGES.map((stage) => [stage.status, stage.defaultChance]));
}

function validChance(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

/** Lê o JSON guardado; etapa ausente ou valor inválido volta para a chance padrão. */
export function parseForecastChances(raw: string | null | undefined): ForecastChances {
  const chances = defaultForecastChances();
  if (!raw) return chances;
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return chances;
  }
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return chances;
  for (const status of FORECAST_STATUSES) {
    const value = validChance((stored as Record<string, unknown>)[status]);
    if (value !== null) chances[status] = value;
  }
  return chances;
}

/** Valida o que o diretor salvou: toda etapa com inteiro de 0 a 100. */
export function normalizeForecastChancesInput(input: unknown):
  | { ok: true; chances: ForecastChances }
  | { ok: false; reason: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "Chances inválidas." };
  const chances: ForecastChances = {};
  for (const stage of FORECAST_STAGES) {
    const value = validChance((input as Record<string, unknown>)[stage.status]);
    if (value === null) return { ok: false, reason: `A chance de ${stage.label} precisa ser um número inteiro de 0 a 100.` };
    chances[stage.status] = value;
  }
  return { ok: true, chances };
}

/** Contagem por etapa vinda do banco: total de leads, quantos têm valor e a soma em centavos dos que têm. */
export type ForecastStageAggregate = { status: string; total: number; withValue: number; grossCents: number };

export type ForecastStageLine = {
  status: string;
  label: string;
  count: number;
  grossCents: number;
  chance: number;
  weightedCents: number;
};

export type MonthlyForecast = {
  stages: ForecastStageLine[];
  totalWeightedCents: number;
  totalGrossCents: number;
  /** Leads abertos com valor, que entram na conta. */
  counted: number;
  /** Leads abertos sem valor, que ficaram de fora. */
  withoutValue: number;
};

/** Valor mensal do lead em centavos, ou null quando não há valor positivo. */
export function leadValueCents(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

/** Agrega leads soltos por etapa (mesma conta que o banco faz no group by). */
export function aggregateForecastLeads(leads: ReadonlyArray<{ status: string; monthlyValue: string | number | null | undefined }>): ForecastStageAggregate[] {
  const byStatus = new Map<string, ForecastStageAggregate>();
  for (const lead of leads) {
    const row = byStatus.get(lead.status) ?? { status: lead.status, total: 0, withValue: 0, grossCents: 0 };
    row.total += 1;
    const cents = leadValueCents(lead.monthlyValue);
    if (cents !== null) {
      row.withValue += 1;
      row.grossCents += cents;
    }
    byStatus.set(lead.status, row);
  }
  return [...byStatus.values()];
}

export function computeMonthlyForecast(rows: readonly ForecastStageAggregate[], chances: ForecastChances = defaultForecastChances()): MonthlyForecast {
  const byStatus = new Map(rows.map((row) => [row.status, row]));
  let totalWeightedCents = 0;
  let totalGrossCents = 0;
  let counted = 0;
  let withoutValue = 0;
  const stages = FORECAST_STAGES.map((stage) => {
    const row = byStatus.get(stage.status);
    const count = Math.max(0, Math.trunc(Number(row?.withValue ?? 0)));
    const total = Math.max(count, Math.trunc(Number(row?.total ?? 0)));
    const grossCents = Math.max(0, Math.round(Number(row?.grossCents ?? 0)));
    const chance = chances[stage.status] ?? stage.defaultChance;
    const weightedCents = Math.round((grossCents * chance) / 100);
    totalWeightedCents += weightedCents;
    totalGrossCents += grossCents;
    counted += count;
    withoutValue += total - count;
    return { status: stage.status, label: stage.label, count, grossCents, chance, weightedCents };
  });
  return { stages, totalWeightedCents, totalGrossCents, counted, withoutValue };
}

/** De quem é a previsão, pela regra de escopo dos leads. */
export function forecastScopeLabel(role: string): string {
  if (role === "director") return "Leads abertos da empresa";
  if (role === "manager") return "Leads abertos da unidade";
  if (role === "supervisor") return "Leads abertos da equipe";
  return "Seus leads abertos";
}

/** Quem vê a previsão: o rótulo do escopo e se pode ajustar as chances (só o diretor). */
export function forecastViewer(role: string): { scopeLabel: string; canConfigure: boolean } {
  return { scopeLabel: forecastScopeLabel(role), canConfigure: role === "director" };
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function formatForecastCents(cents: number) {
  return currency.format(Math.round(cents / 100));
}

export function withoutValueLabel(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "1 lead sem valor ficou de fora." : `${count} leads sem valor ficaram de fora.`;
}
