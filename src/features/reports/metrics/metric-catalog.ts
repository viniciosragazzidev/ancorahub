/**
 * Catálogo canônico de métricas do CorreTop (DEC-090, ADR-0040).
 *
 * REGRA: toda superfície que exibir um destes indicadores DEVE consumir o
 * resolvedor correspondente em `metrics-service.ts`. Nenhuma tela recalcula
 * a métrica localmente. Mudança de definição = nova versão aqui + entrada no
 * decision-log.
 */

export type MetricFormat = "count" | "percentage" | "currency" | "seconds" | "days";

export type MetricDimension = "unit" | "broker" | "source" | "period";

export interface MetricDefinition {
  /** Identificador estável, ex.: "commercial.conversion_rate". */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly format: MetricFormat;
  /** Explicação de numerador/denominário exibida no drill-down. */
  readonly explanation: string;
  readonly allowedDimensions: readonly MetricDimension[];
  /** Versão da definição; alterações semânticas exigem bump + DEC. */
  readonly version: number;
}

export const METRIC_CATALOG: readonly MetricDefinition[] = [
  {
    id: "commercial.leads_received",
    label: "Leads recebidos",
    description: "Leads criados no período, excluídos registros apagados.",
    format: "count",
    explanation: "Contagem de leads com data de criação dentro do período, no escopo autorizado.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.conversion_rate",
    label: "Taxa de conversão",
    description: "Coorte de entrada: convertidos ÷ leads recebidos no período (DEC-090).",
    format: "percentage",
    explanation:
      "Leads recebidos no período que alcançaram o estágio `converted` ÷ leads recebidos no mesmo período. Numerador e denominador pertencem à mesma população.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.sales",
    label: "Vendas",
    description: "Vendas registradas (data de fechamento) no período.",
    format: "count",
    explanation: "Contagem de vendas com data de fechamento dentro do período, no escopo autorizado.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.loss_rate",
    label: "Taxa de perda",
    description: "Leads perdidos ÷ leads recebidos no período (coorte de entrada).",
    format: "percentage",
    explanation: "Leads recebidos no período com status `lost` ÷ leads recebidos no mesmo período.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.average_sale_cycle_time",
    label: "Tempo médio até a conversão",
    description: "Média entre a criação do lead e o fechamento da venda, na coorte convertida.",
    format: "days",
    explanation:
      "Média de (data da venda − data de criação do lead) para as vendas cujo lead entrou no período.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.first_contact_sla_rate",
    label: "SLA de primeiro contato",
    description: "Leads atendidos dentro do SLA do tenant ÷ leads distribuídos com atendimento iniciado.",
    format: "percentage",
    explanation:
      "Leads com latência de primeiro contato ≤ slaFirstContactMinutes do tenant ÷ leads distribuídos no período com primeiro contato registrado.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.average_first_contact_latency",
    label: "Tempo médio até o primeiro contato",
    description: "Média da latência registrada de primeiro contato dos leads do período.",
    format: "seconds",
    explanation: "Média de firstContactLatencySeconds dos leads distribuídos no período.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.high_intent_unassigned",
    label: "Alta intenção sem corretor",
    description: "Leads com qualificação hot ainda sem corretor responsável (item de atenção).",
    format: "count",
    explanation: "Leads ativos com qualificationStatus `hot` e sem corretor atribuído.",
    allowedDimensions: ["unit", "period"],
    version: 1,
  },
  {
    id: "commercial.stale_negotiations",
    label: "Negociações paradas",
    description: "Leads em negociação/documentação/análise sem avanço de etapa (item de atenção).",
    format: "count",
    explanation:
      "Leads em estágio avançado cuja entrada na etapa atual excede slaStagnantDays do tenant.",
    allowedDimensions: ["unit", "broker", "period"],
    version: 1,
  },
  {
    id: "team.brokers_over_capacity",
    label: "Corretores acima da capacidade",
    description: "Corretores com carteira ativa acima da capacidade da fila (item de atenção).",
    format: "count",
    explanation:
      "Corretores cujo número de leads ativos excede a capacidade configurada na fila responsável.",
    allowedDimensions: ["unit", "period"],
    version: 1,
  },
  {
    id: "financial.gross_revenue",
    label: "Receita bruta",
    description: "Soma do valor de vendas ativas fechadas no período.",
    format: "currency",
    explanation: "Soma de saleValue das vendas com status `active` e data de fechamento no período.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "financial.average_ticket",
    label: "Ticket médio",
    description: "Receita bruta ÷ vendas ativas do período.",
    format: "currency",
    explanation: "Média de saleValue das vendas ativas com data de fechamento no período.",
    allowedDimensions: ["unit", "broker", "source", "period"],
    version: 1,
  },
] as const;

const METRIC_INDEX = new Map(METRIC_CATALOG.map((metric) => [metric.id, metric]));

export function getMetricDefinition(id: string): MetricDefinition | undefined {
  return METRIC_INDEX.get(id);
}

/** Abas permitidas por papel (matriz conservadora da DEC-090). */
export type ReportTabId = "overview" | "commercial" | "team" | "units" | "financial";

export const REPORT_TAB_LABELS: Record<ReportTabId, string> = {
  overview: "Visão geral",
  commercial: "Comercial",
  team: "Equipe",
  units: "Unidades",
  financial: "Financeiro",
};

export const REPORT_TAB_ORDER: readonly ReportTabId[] = [
  "overview",
  "commercial",
  "team",
  "units",
  "financial",
];

export type ReportRole = "director" | "manager" | "supervisor" | "broker";

const TABS_BY_ROLE: Record<ReportRole, readonly ReportTabId[]> = {
  director: ["overview", "commercial", "team", "units", "financial"],
  manager: ["overview", "commercial", "team", "units", "financial"],
  supervisor: ["commercial", "team"],
  broker: ["commercial"],
};

/**
 * Abas visíveis para o papel. Financeiro é filtrada pela capability
 * `ver_relatorios_financeiros` no chamador; Unidades para gestor renderiza
 * somente a própria unidade (sem comparativo).
 */
export function reportTabsForRole(role: ReportRole): readonly ReportTabId[] {
  return TABS_BY_ROLE[role] ?? ["commercial"];
}

export function isReportTab(raw: unknown): raw is ReportTabId {
  return typeof raw === "string" && REPORT_TAB_ORDER.includes(raw as ReportTabId);
}
