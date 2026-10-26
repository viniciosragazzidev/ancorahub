/**
 * Catálogo canônico de métricas do CorreTop (DEC-090, ADR-0040).
 *
 * REGRA: toda superfície que exibir um destes indicadores DEVE consumir o
 * resolvedor correspondente em `metrics-service.ts`. Nenhuma tela recalcula
 * a métrica localmente. Mudança de definição = nova versão aqui + entrada no
 * decision-log.
 */

export type MetricFormat = "count" | "percentage" | "currency" | "seconds" | "days" | "datetime";

export type MetricDimension =
  | "unit"
  | "team"
  | "broker"
  | "source"
  | "period"
  | "qualification_temperature"
  | "campaign"
  | "adset"
  | "ad"
  | "form"
  | "queue"
  | "lead_type"
  | "plan_type"
  | "city"
  | "age_band"
  | "weekday_hour";

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
    allowedDimensions: ["unit", "team", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.conversion_rate",
    label: "Taxa de conversão",
    description: "Coorte de entrada: convertidos ÷ leads recebidos no período (DEC-090).",
    format: "percentage",
    explanation:
      "Leads recebidos no período que alcançaram o estágio `converted` ÷ leads recebidos no mesmo período. Numerador e denominador pertencem à mesma população.",
    allowedDimensions: ["unit", "team", "broker", "source", "period"],
    version: 1,
  },
  {
    id: "commercial.leads_converted",
    label: "Leads convertidos",
    description: "Leads recebidos na janela que alcançaram o estágio converted.",
    format: "count",
    explanation: "Numerador da métrica commercial.conversion_rate: leads da coorte de entrada com status converted.",
    allowedDimensions: ["unit", "team", "broker", "source", "period"],
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
    id: "lead_quality.temperature_distribution",
    label: "Distribuição de temperatura",
    description: "Classificações quentes, mornas e frias persistidas na coorte de entrada.",
    format: "count",
    explanation: "Contagem de leads por `qualificationStatus` atual (`hot`, `warm` ou `cold`); os demais estados ficam sem temperatura e não são recalculados pelo score.",
    allowedDimensions: ["period", "source", "campaign", "adset", "ad", "form", "queue", "broker", "lead_type", "plan_type", "city", "age_band", "weekday_hour"],
    version: 1,
  },
  {
    id: "lead_quality.classification_coverage",
    label: "Cobertura de classificação",
    description: "Leads com temperatura persistida ÷ leads da coorte de entrada.",
    format: "percentage",
    explanation: "Contagem com `qualificationStatus` em `hot`, `warm` ou `cold` ÷ total de leads recebidos na mesma coorte.",
    allowedDimensions: ["period", "source", "campaign", "adset", "ad", "form", "queue", "broker", "lead_type", "plan_type", "city", "age_band", "weekday_hour"],
    version: 1,
  },
  {
    id: "lead_quality.hot_warm_conversion_rate",
    label: "Conversão de quentes e mornos",
    description: "Leads quentes/mornos da coorte com status atual convertido ÷ leads quentes/mornos da coorte.",
    format: "percentage",
    explanation: "Leads atualmente `converted` e com temperatura persistida atual `hot` ou `warm` ÷ todos os leads atualmente `hot` ou `warm` da coorte. Não é conversão histórica por temperatura.",
    allowedDimensions: ["period", "source", "campaign", "adset", "ad", "form", "queue", "broker", "lead_type", "plan_type", "city", "age_band", "weekday_hour"],
    version: 1,
  },
  {
    id: "lead_quality.meta_ad_attribution_coverage",
    label: "Atribuição confirmada a anúncio Meta",
    description: "Leads da coorte com ID de anúncio Meta persistido ÷ leads da coorte.",
    format: "percentage",
    explanation: "Contagem com `metaAdId` persistido ÷ total de leads recebidos no mesmo recorte; nomes ou orçamento não são usados para inferir atribuição ou custo.",
    allowedDimensions: ["period", "source", "campaign", "adset", "ad", "form", "queue", "broker", "lead_type", "plan_type", "city", "age_band", "weekday_hour"],
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
    id: "team.offers_received",
    label: "Ofertas recebidas",
    description: "Ofertas de lead recebidas na janela, sem cancelamentos ou leads perdidos.",
    format: "count",
    explanation: "Contagem de lead_offers por offered_at na janela; status CANCELLED e LOST são excluídos.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.offers_accepted",
    label: "Ofertas aceitas",
    description: "Ofertas recebidas na janela com aceite registrado.",
    format: "count",
    explanation: "Contagem de ofertas da coorte de recebimento com accepted_at preenchido.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.acceptance_rate",
    label: "Taxa de aceite",
    description: "Ofertas aceitas ÷ ofertas recebidas na mesma janela.",
    format: "percentage",
    explanation: "Ofertas da janela com aceite registrado ÷ ofertas da janela, excluídos CANCELLED e LOST.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.median_acceptance_time",
    label: "Mediana do tempo de aceite",
    description: "Mediana do tempo entre o recebimento da oferta e o aceite.",
    format: "seconds",
    explanation: "Mediana de accepted_at − offered_at para ofertas aceitas recebidas na janela.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.redistributions",
    label: "Redistribuições",
    description: "Ofertas expiradas, recusadas ou substituídas na janela.",
    format: "count",
    explanation: "Contagem de ofertas recebidas na janela com status EXPIRED, DECLINED ou REPLACED; CANCELLED e LOST ficam fora.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.first_contact_sla_rate",
    label: "SLA de primeiro contato da equipe",
    description: "Leads atribuídos na janela com primeiro contato dentro do prazo do tenant ÷ leads atribuídos na janela.",
    format: "percentage",
    explanation: "Contatos feitos até assigned_at + sla_first_contact_minutes ÷ leads não apagados atribuídos na janela; leads sem contato permanecem no denominador.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.first_contact_sla_leads",
    label: "Leads no SLA de primeiro contato",
    description: "Leads atribuídos na janela usados como denominador da taxa de SLA.",
    format: "count",
    explanation: "Contagem de leads não apagados atribuídos na janela, incluindo leads sem primeiro contato.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.active_leads",
    label: "Leads ativos",
    description: "Carteira atual de leads em estágios não terminais.",
    format: "count",
    explanation: "Leads atribuídos ao corretor em estágio ativo, não apagados nem arquivados, no momento da consulta.",
    allowedDimensions: ["unit", "team", "broker"],
    version: 1,
  },
  {
    id: "team.overdue_returns",
    label: "Retornos vencidos",
    description: "Tarefas abertas com prazo anterior ao momento da consulta.",
    format: "count",
    explanation: "Tarefas sem completed_at, vinculadas a lead ativo, com due_at anterior ao momento da consulta.",
    allowedDimensions: ["unit", "team", "broker"],
    version: 1,
  },
  {
    id: "team.critical_overdue_returns",
    label: "Retornos críticos vencidos",
    description: "Tarefas urgentes abertas e vencidas em leads ativos.",
    format: "count",
    explanation: "Tarefas abertas com prioridade urgent e due_at anterior ao momento da consulta, vinculadas a lead ativo.",
    allowedDimensions: ["unit", "team", "broker"],
    version: 1,
  },
  {
    id: "team.leads_without_next_action",
    label: "Leads sem próxima ação",
    description: "Leads em atendimento sem tarefa aberta.",
    format: "count",
    explanation: "Leads em estágio de atendimento sem nenhuma lead_task aberta, não apagados nem arquivados.",
    allowedDimensions: ["unit", "team", "broker"],
    version: 1,
  },
  {
    id: "team.quotes",
    label: "Cotações",
    description: "Cotações criadas na janela para leads da carteira do corretor.",
    format: "count",
    explanation: "Contagem de quotes por created_at, associadas a lead não apagado nem arquivado dentro do escopo.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.sales",
    label: "Vendas",
    description: "Vendas ativas fechadas na janela por corretor responsável pela venda.",
    format: "count",
    explanation: "Contagem de sales ativas por sale_date, associadas a lead não apagado nem arquivado dentro do escopo.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.losses",
    label: "Perdas",
    description: "Leads da coorte recebida na janela que estão com status perdido.",
    format: "count",
    explanation: "Contagem de leads da coorte de criação da janela cujo status atual é lost.",
    allowedDimensions: ["unit", "team", "broker", "period"],
    version: 1,
  },
  {
    id: "team.last_activity_at",
    label: "Última atividade",
    description: "Data mais recente de atualização de lead, oferta, tarefa, cotação ou venda do corretor.",
    format: "datetime",
    explanation: "Máximo updated_at (ou sale_date para vendas) dos registros operacionais dentro do escopo.",
    allowedDimensions: ["unit", "team", "broker"],
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
