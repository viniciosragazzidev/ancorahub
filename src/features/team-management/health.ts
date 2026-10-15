export type TeamHealthBand = "Excelente" | "Saudável" | "Atenção" | "Crítico";
export type TeamHealthComponentId = "sla" | "acceptance" | "pending" | "conversion" | "redistributions" | "activity_balance";

export type TeamHealthInput = {
  slaRate: number;
  acceptanceRate: number;
  overdueReturns: number;
  leadsWithoutNextAction: number;
  activeLeads: number;
  conversionRate: number;
  unitAverageConversionRate: number;
  redistributions: number;
  offersReceived: number;
  activeBrokers: number;
  brokersActiveWithinTwoBusinessDays: number;
  brokerActiveLeads: readonly number[];
};

export type TeamHealthResult = {
  score: number;
  band: TeamHealthBand;
  strongPoints: readonly string[];
  attentionPoints: readonly string[];
  components: Readonly<Record<TeamHealthComponentId, number>>;
};

export const TEAM_HEALTH_WEIGHTS: Readonly<Record<TeamHealthComponentId, number>> = {
  sla: 25,
  acceptance: 20,
  pending: 20,
  conversion: 15,
  redistributions: 10,
  activity_balance: 10,
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const percent = (value: number) => clamp(value);
const asCount = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);
const ptPercent = (value: number) => `${Math.round(value).toLocaleString("pt-BR")}%`;

function healthBand(score: number): TeamHealthBand {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Saudável";
  if (score >= 50) return "Atenção";
  return "Crítico";
}

function componentPhrase(
  id: TeamHealthComponentId,
  input: TeamHealthInput,
  teamMean: number,
  label: "Destaque" | "Ponto de atenção",
) {
  let description: string;
  switch (id) {
    case "sla": description = `SLA de primeiro contato em ${ptPercent(input.slaRate)}`; break;
    case "acceptance": description = `taxa de aceite em ${ptPercent(input.acceptanceRate)}`; break;
    case "pending": description = `${asCount(input.overdueReturns) + asCount(input.leadsWithoutNextAction)} pendências entre retornos vencidos e leads sem próxima ação`; break;
    case "conversion": description = `conversão de ${ptPercent(input.conversionRate)} (média da unidade: ${ptPercent(input.unitAverageConversionRate)})`; break;
    case "redistributions": description = `${asCount(input.redistributions)} redistribuições em ${asCount(input.offersReceived)} ofertas recebidas`; break;
    case "activity_balance": description = `atividade recente em ${asCount(input.brokersActiveWithinTwoBusinessDays)} de ${asCount(input.activeBrokers)} corretores e média de ${teamMean.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} leads ativos`; break;
  }
  return `${label}: ${description}.`;
}

/** Deterministic team health score using the weights approved in the plan. */
export function teamHealthScore(input: TeamHealthInput): TeamHealthResult {
  const activeLeads = asCount(input.activeLeads);
  const received = asCount(input.offersReceived);
  const redistributions = asCount(input.redistributions);
  const activeBrokers = asCount(input.activeBrokers);
  const pendingCount = asCount(input.overdueReturns) + asCount(input.leadsWithoutNextAction);
  const unitMean = Math.max(0, Number.isFinite(input.unitAverageConversionRate) ? input.unitAverageConversionRate : 0);
  const conversion = Math.max(0, Number.isFinite(input.conversionRate) ? input.conversionRate : 0);
  const teamMean = input.brokerActiveLeads.length
    ? input.brokerActiveLeads.reduce((sum, count) => sum + asCount(count), 0) / input.brokerActiveLeads.length
    : 0;
  const activityRate = activeBrokers > 0
    ? clamp(asCount(input.brokersActiveWithinTwoBusinessDays) / activeBrokers * 100)
    : 50;
  const balancedLoadRate = input.brokerActiveLeads.length > 0
    ? input.brokerActiveLeads.filter((load) => asCount(load) <= teamMean * 1.5).length / input.brokerActiveLeads.length * 100
    : 50;

  const components: Record<TeamHealthComponentId, number> = {
    sla: percent(input.slaRate),
    acceptance: percent(input.acceptanceRate),
    pending: activeLeads > 0 ? clamp(100 - pendingCount / activeLeads * 100) : pendingCount === 0 ? 100 : 0,
    conversion: unitMean > 0 ? clamp(conversion / unitMean * 100) : conversion > 0 ? 100 : 50,
    redistributions: received > 0 ? clamp(100 - redistributions / received * 100) : 50,
    activity_balance: (activityRate + balancedLoadRate) / 2,
  };
  const weightedScore = Object.entries(TEAM_HEALTH_WEIGHTS).reduce((sum, [id, weight]) =>
    sum + components[id as TeamHealthComponentId] * weight, 0) / 100;
  const score = Math.round(clamp(weightedScore));
  const ranked = (Object.keys(components) as TeamHealthComponentId[])
    .map((id) => ({ id, score: components[id] }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const strengths = ranked.slice(0, 2);
  const attention = [...ranked].reverse().slice(0, 2);

  return {
    score,
    band: healthBand(score),
    strongPoints: strengths.map(({ id }) => componentPhrase(id, input, teamMean, "Destaque")),
    attentionPoints: attention.map(({ id }) => componentPhrase(id, input, teamMean, "Ponto de atenção")),
    components,
  };
}
