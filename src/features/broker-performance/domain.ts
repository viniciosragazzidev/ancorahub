import type { CanonicalMetricWindowDays } from "@/features/reports/metrics/metric-windows";

/**
 * Desempenho Lite do corretor: projeção pura dos números já calculados pelo motor canônico
 * (escopo broker). Nada aqui recalcula métrica; só formata, compara e escolhe a frase.
 */

export const BROKER_PERFORMANCE_PERIODS = ["hoje", "7d", "30d"] as const;
export type BrokerPerformancePeriod = (typeof BROKER_PERFORMANCE_PERIODS)[number];

export const PERIOD_WINDOW: Record<BrokerPerformancePeriod, CanonicalMetricWindowDays> = { hoje: 1, "7d": 7, "30d": 30 };
export const PERIOD_LABEL: Record<BrokerPerformancePeriod, string> = { hoje: "Hoje", "7d": "7 dias", "30d": "30 dias" };
const COMPARISON_LABEL: Record<BrokerPerformancePeriod, string> = { hoje: "vs ontem", "7d": "vs 7 dias antes", "30d": "vs 30 dias antes" };

export function parseBrokerPerformancePeriod(raw: unknown): BrokerPerformancePeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return BROKER_PERFORMANCE_PERIODS.includes(value as BrokerPerformancePeriod) ? (value as BrokerPerformancePeriod) : "7d";
}

export type BrokerPerformanceTotals = {
  leads: number;
  quotes: number;
  sales: number;
  revenue: number;
  slaRate: number;
  slaLeads: number;
};

/** Um dia de São Paulo da série (7 e 30 dias). */
export type BrokerPerformanceSeriesPoint = {
  key: string;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  leads: number;
  quotes: number;
  sales: number;
  revenue: number;
};

export type BrokerCarrierSales = { name: string; sales: number; revenue: number };

export type BrokerGoalInput = {
  name: string;
  targetType: string;
  targetValue: number;
  current: number;
  percentage: number;
  /** Último dia da meta em São Paulo (YYYY-MM-DD). */
  endDay: string;
};

export type BrokerPerformanceData = {
  period: BrokerPerformancePeriod;
  /** Dia de hoje em São Paulo (YYYY-MM-DD), para o ritmo da meta. */
  today: string;
  current: BrokerPerformanceTotals;
  previous: BrokerPerformanceTotals;
  series: BrokerPerformanceSeriesPoint[];
  carriers: BrokerCarrierSales[];
  goal: BrokerGoalInput | null;
};

export type BrokerMetricChange =
  | { kind: "percent"; value: number; direction: "up" | "down" }
  | { kind: "new"; direction: "up" }
  | { kind: "flat" };

export type BrokerMetricCard = {
  key: "leads" | "quotes" | "sales" | "revenue";
  label: string;
  value: number;
  format: "integer" | "currency";
  change: BrokerMetricChange | null;
  comparisonLabel: string;
};

export type BrokerFunnelStage = { key: "leads" | "quotes" | "sales"; label: string; value: number; widthPercent: number };

export type BrokerGoalView = {
  name: string;
  percentage: number;
  currentLabel: string;
  targetLabel: string;
  pace: string | null;
};

export type BrokerPerformanceView = {
  period: BrokerPerformancePeriod;
  summary: string;
  empty: boolean;
  cards: BrokerMetricCard[];
  funnel: { stages: BrokerFunnelStage[]; note: string | null };
  goal: BrokerGoalView | null;
  insight: string | null;
  carriers: Array<BrokerCarrierSales & { revenueLabel: string }>;
};

const integer = new Intl.NumberFormat("pt-BR");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function formatBrl(value: number) {
  return currency.format(Math.round(value));
}

const plural = (count: number, one: string, many: string) => `${integer.format(count)} ${count === 1 ? one : many}`;

export function metricChange(current: number, previous: number): BrokerMetricChange | null {
  if (current === 0 && previous === 0) return null;
  if (previous === 0) return { kind: "new", direction: "up" };
  const ratio = (current - previous) / previous;
  if (Math.abs(ratio) < 0.005) return { kind: "flat" };
  return { kind: "percent", value: ratio, direction: ratio > 0 ? "up" : "down" };
}

/** Dias úteis (seg a sex) de hoje até o último dia da meta, os dois inclusive. */
export function businessDaysLeft(today: string, endDay: string): number {
  const toUtc = (day: string) => {
    const [year, month, date] = day.split("-").map(Number);
    return Date.UTC(year, month - 1, date);
  };
  let count = 0;
  for (let cursor = toUtc(today), end = toUtc(endDay); cursor <= end; cursor += 86_400_000) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

const PACED_GOALS: Record<string, { one: string; many: string } | "currency"> = {
  sales_count: { one: "venda", many: "vendas" },
  quotes_count: { one: "cotação", many: "cotações" },
  leads_contacted: { one: "contato", many: "contatos" },
  revenue: "currency",
};

function goalValueLabel(targetType: string, value: number) {
  if (targetType === "revenue") return formatBrl(value);
  if (targetType === "conversion_rate" || targetType === "sla_rate") return `${decimal.format(value)}%`;
  if (targetType === "response_minutes") return `${decimal.format(value)} min`;
  return integer.format(value);
}

export function buildGoalView(goal: BrokerGoalInput, today: string): BrokerGoalView {
  const percentage = Math.round(Math.min(100, Math.max(0, goal.percentage)));
  const view = {
    name: goal.name,
    percentage,
    currentLabel: goalValueLabel(goal.targetType, goal.current),
    targetLabel: goalValueLabel(goal.targetType, goal.targetValue),
  };
  const unit = PACED_GOALS[goal.targetType];
  if (!unit) return { ...view, pace: null };
  const remaining = Math.max(0, goal.targetValue - goal.current);
  if (remaining === 0) return { ...view, pace: "Meta batida. O que vier agora é extra." };
  const days = businessDaysLeft(today, goal.endDay);
  const remainingLabel = unit === "currency" ? formatBrl(remaining) : plural(Math.ceil(remaining), unit.one, unit.many);
  if (days === 0) return { ...view, pace: `Faltam ${remainingLabel} e o prazo da meta acabou.` };
  if (days === 1) return { ...view, pace: `Faltam ${remainingLabel}, e hoje é o último dia útil.` };
  const perDay = remaining / days;
  const perDayLabel = unit === "currency" ? formatBrl(perDay) : decimal.format(perDay);
  return { ...view, pace: `Faltam ${remainingLabel} em ${days} dias úteis, cerca de ${perDayLabel} por dia.` };
}

function bestWeekday(series: readonly BrokerPerformanceSeriesPoint[]): { weekday: number; sales: number } | null {
  const totals = new Map<number, number>();
  for (const point of series) totals.set(point.weekday, (totals.get(point.weekday) ?? 0) + point.sales);
  let best: { weekday: number; sales: number } | null = null;
  for (const [weekday, sales] of totals) if (sales > 0 && (!best || sales > best.sales)) best = { weekday, sales };
  const tied = best ? [...totals.values()].filter((sales) => sales === best!.sales).length > 1 : false;
  return tied ? null : best;
}

/** Uma frase por regra fixa, da mais urgente para a mais leve. Sem dado suficiente, nenhuma frase. A meta já fala no anel. */
export function pickInsight(data: BrokerPerformanceData): string | null {
  const { current, previous, period } = data;
  if (current.slaLeads >= 3 && current.slaRate < 80) {
    return `Só ${decimal.format(current.slaRate)}% dos seus leads tiveram o primeiro contato no prazo. Responder rápido é o que mais pesa no começo do funil.`;
  }
  if (current.sales > previous.sales && previous.sales > 0) {
    return `Você fez ${plural(current.sales - previous.sales, "venda", "vendas")} a mais que no período anterior.`;
  }
  if (current.quotes >= 3 && current.sales <= current.quotes) {
    const rate = Math.round((current.sales / current.quotes) * 100);
    if (rate < 40) return `${rate}% das suas cotações viraram venda. Retomar as cotações abertas é o próximo passo.`;
  }
  if (period !== "hoje") {
    const best = bestWeekday(data.series);
    if (best) return `Seu melhor dia foi ${WEEKDAYS[best.weekday]}, com ${plural(best.sales, "venda", "vendas")}.`;
  }
  return null;
}

/** Uma linha de contexto no topo; o ritmo da meta fica só no anel, para não repetir. */
function summaryFor(data: BrokerPerformanceData, empty: boolean): string {
  if (empty) return data.period === "hoje" ? "Nenhum movimento hoje ainda. Seus números aparecem aqui ao longo do dia." : "Nenhum movimento neste período.";
  const when = data.period === "hoje" ? "hoje" : `nos últimos ${PERIOD_LABEL[data.period]}`;
  return `${plural(data.current.sales, "venda", "vendas")} e ${formatBrl(data.current.revenue)} ${when}.`;
}

export function buildBrokerPerformanceView(data: BrokerPerformanceData): BrokerPerformanceView {
  const { current, previous, period } = data;
  const empty = current.leads === 0 && current.quotes === 0 && current.sales === 0;
  const comparisonLabel = COMPARISON_LABEL[period];
  const card = (key: BrokerMetricCard["key"], label: string, format: BrokerMetricCard["format"]): BrokerMetricCard => ({
    key,
    label,
    value: current[key],
    format,
    change: metricChange(current[key], previous[key]),
    comparisonLabel,
  });

  const funnelMax = Math.max(current.leads, current.quotes, current.sales, 1);
  const stages: BrokerFunnelStage[] = [
    { key: "leads", label: "Leads recebidos", value: current.leads },
    { key: "quotes", label: "Cotações", value: current.quotes },
    { key: "sales", label: "Vendas", value: current.sales },
  ].map((stage) => ({ ...(stage as Omit<BrokerFunnelStage, "widthPercent">), widthPercent: Math.round((stage.value / funnelMax) * 100) }));
  const quoteRate = current.leads > 0 && current.quotes <= current.leads ? Math.round((current.quotes / current.leads) * 100) : null;
  const saleRate = current.quotes > 0 && current.sales <= current.quotes ? Math.round((current.sales / current.quotes) * 100) : null;
  const note = quoteRate !== null && saleRate !== null
    ? saleRate <= quoteRate
      ? `Onde mais perde: da cotação para a venda (${saleRate}% viram venda).`
      : `Onde mais perde: do lead para a cotação (${quoteRate}% viram cotação).`
    : null;

  const goal = data.goal ? buildGoalView(data.goal, data.today) : null;
  return {
    period,
    summary: summaryFor(data, empty),
    empty,
    cards: [card("leads", "Leads", "integer"), card("quotes", "Cotações", "integer"), card("sales", "Vendas", "integer"), card("revenue", "Receita", "currency")],
    funnel: { stages, note: empty ? null : note },
    goal,
    insight: empty ? null : pickInsight(data),
    carriers: data.carriers.slice(0, 5).map((carrier) => ({ ...carrier, revenueLabel: formatBrl(carrier.revenue) })),
  };
}
