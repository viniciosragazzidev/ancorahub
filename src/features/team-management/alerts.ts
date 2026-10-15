import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "./metrics";

export type TeamAlertSeverity = "info" | "warning" | "critical";
export type TeamAlert = {
  id: "no_accept_in_duty" | "redistributions_rising" | "many_without_next_action" | "conversion_falling" | "overloaded" | "few_leads" | "team_sla_worsening" | "critical_pending";
  severity: TeamAlertSeverity;
  message: string;
  subjectId: string;
  subjectType: "broker" | "team";
};

export type AlertThresholds = {
  noAcceptHours: number;
  redistributionRise: number;
  manyWithoutNextAction: number;
  conversionDrop: number;
  loadDifference: number;
  lowLeadShare: number;
  slaWorsening: number;
  criticalPendingCount: number;
};

export const DEFAULT_ALERT_THRESHOLDS: Readonly<AlertThresholds> = {
  noAcceptHours: 2,
  redistributionRise: 0.4,
  manyWithoutNextAction: 3,
  conversionDrop: 0.3,
  loadDifference: 0.5,
  lowLeadShare: 0.5,
  slaWorsening: 0.05,
  criticalPendingCount: 3,
};

export type OnDutyBroker = {
  id: string;
  name: string;
  dutyStartedAt: Date;
  lastAcceptedAt: Date | null;
};

export type BrokerAlertInput = {
  broker: TeamMetricBroker;
  now: Date;
  windowDays: 7;
  onDuty: OnDutyBroker | null;
  teamAverageActiveLeads: number;
  thresholds?: Partial<AlertThresholds>;
};

export type TeamAlertInput = {
  team: TeamMetricTeam;
  now: Date;
  windowDays: 7;
  onDutyBrokers: readonly OnDutyBroker[];
  thresholds?: Partial<AlertThresholds>;
};

function limits(overrides?: Partial<AlertThresholds>): AlertThresholds {
  const result = { ...DEFAULT_ALERT_THRESHOLDS, ...overrides };
  if (Object.values(result).some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Os limites dos alertas devem ser números não negativos.");
  }
  return result;
}

function exceedsComparedTo(value: number, previous: number, increase: number) {
  if (previous === 0) return value > 0;
  return value >= previous * (1 + increase);
}

function fellBy(current: number, previous: number, decrease: number) {
  return previous > 0 && current <= previous * (1 - decrease);
}

function dutyWithoutAcceptance(duty: OnDutyBroker | null, now: Date, hours: number) {
  if (!duty || now.getTime() - duty.dutyStartedAt.getTime() < hours * 3_600_000) return false;
  const acceptanceCutoff = now.getTime() - hours * 3_600_000;
  return duty.lastAcceptedAt === null || duty.lastAcceptedAt.getTime() <= acceptanceCutoff;
}

function noActionCount(metrics: TeamMetricWindow) {
  return metrics.leadsWithoutNextAction ?? 0;
}

export function brokerTeamAlerts(input: BrokerAlertInput): TeamAlert[] {
  const { broker, now } = input;
  const threshold = limits(input.thresholds);
  const alerts: TeamAlert[] = [];
  const activeLeads = broker.current.activeLeads ?? 0;
  const teamAverage = Math.max(0, input.teamAverageActiveLeads);
  const unit = { subjectId: broker.id, subjectType: "broker" as const };

  if (dutyWithoutAcceptance(input.onDuty, now, threshold.noAcceptHours)) {
    alerts.push({ id: "no_accept_in_duty", severity: "warning", message: `${broker.name} está há pelo menos ${threshold.noAcceptHours} horas no plantão sem aceitar uma oferta.`, ...unit });
  }
  if (exceedsComparedTo(broker.recent3DaysRedistributions, broker.previous3DaysRedistributions, threshold.redistributionRise)) {
    alerts.push({ id: "redistributions_rising", severity: "warning", message: `As redistribuições de ${broker.name} subiram mais de ${Math.round(threshold.redistributionRise * 100)}% nos últimos 3 dias.`, ...unit });
  }
  if (noActionCount(broker.current) >= threshold.manyWithoutNextAction) {
    alerts.push({ id: "many_without_next_action", severity: "warning", message: `${broker.name} tem ${noActionCount(broker.current)} leads sem próxima ação.`, ...unit });
  }
  if (fellBy(broker.current.conversion.rate, broker.previous.conversion.rate, threshold.conversionDrop)) {
    alerts.push({ id: "conversion_falling", severity: "warning", message: `A conversão de ${broker.name} caiu pelo menos ${Math.round(threshold.conversionDrop * 100)}% nesta janela de 7 dias.`, ...unit });
  }
  if (teamAverage > 0 && activeLeads > teamAverage * (1 + threshold.loadDifference)) {
    alerts.push({ id: "overloaded", severity: "warning", message: `${broker.name} está com ${activeLeads} leads ativos, mais de ${Math.round(threshold.loadDifference * 100)}% acima da média da equipe (${teamAverage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}).`, ...unit });
  }
  if (teamAverage > 0 && activeLeads < teamAverage * threshold.lowLeadShare) {
    alerts.push({ id: "few_leads", severity: "info", message: `${broker.name} está com menos da metade da média de leads ativos da equipe (${activeLeads} contra ${teamAverage.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}).`, ...unit });
  }
  return alerts;
}

export function teamAlerts(input: TeamAlertInput): TeamAlert[] {
  const { team, now } = input;
  const threshold = limits(input.thresholds);
  const alerts: TeamAlert[] = [];
  const unit = { subjectId: team.id, subjectType: "team" as const };
  const overdue = team.current.criticalOverdueReturns ?? 0;
  const average = team.brokers.length > 0
    ? team.brokers.reduce((sum, broker) => sum + (broker.current.activeLeads ?? 0), 0) / team.brokers.length
    : 0;

  const noAccept = input.onDutyBrokers.filter((duty) => dutyWithoutAcceptance(duty, now, threshold.noAcceptHours));
  if (noAccept.length > 0) {
    const names = noAccept.map((duty) => duty.name);
    const who = names.length > 2 ? `${names.slice(0, 2).join(" e ")} e mais ${names.length - 2}` : names.join(" e ");
    alerts.push({ id: "no_accept_in_duty", severity: "warning", message: `${who} ${names.length === 1 ? "está" : "estão"} há pelo menos ${threshold.noAcceptHours} horas no plantão sem aceitar uma oferta.`, ...unit });
  }
  if (exceedsComparedTo(team.recent3DaysRedistributions, team.previous3DaysRedistributions, threshold.redistributionRise)) {
    alerts.push({ id: "redistributions_rising", severity: "warning", message: `As redistribuições da equipe subiram mais de ${Math.round(threshold.redistributionRise * 100)}% nos últimos 3 dias.`, ...unit });
  }
  if (noActionCount(team.current) >= threshold.manyWithoutNextAction) {
    alerts.push({ id: "many_without_next_action", severity: "warning", message: `${noActionCount(team.current)} leads da equipe estão sem próxima ação.`, ...unit });
  }
  if (fellBy(team.current.conversion.rate, team.previous.conversion.rate, threshold.conversionDrop)) {
    alerts.push({ id: "conversion_falling", severity: "warning", message: `A conversão da equipe caiu pelo menos ${Math.round(threshold.conversionDrop * 100)}% nesta janela de 7 dias.`, ...unit });
  }

  const overloaded = team.brokers.filter((broker) => average > 0 && (broker.current.activeLeads ?? 0) > average * (1 + threshold.loadDifference));
  if (overloaded.length > 0) {
    alerts.push({ id: "overloaded", severity: "warning", message: `${overloaded.length} ${overloaded.length === 1 ? "corretor está" : "corretores estão"} com mais de ${Math.round(threshold.loadDifference * 100)}% acima da média de leads ativos da equipe.`, ...unit });
  }
  const fewLeads = team.brokers.filter((broker) => average > 0 && (broker.current.activeLeads ?? 0) < average * threshold.lowLeadShare);
  if (fewLeads.length > 0) {
    alerts.push({ id: "few_leads", severity: "info", message: `${fewLeads.length} ${fewLeads.length === 1 ? "corretor está" : "corretores estão"} com menos da metade da média de leads ativos da equipe.`, ...unit });
  }
  if (fellBy(team.current.slaRate, team.previous.slaRate, threshold.slaWorsening)) {
    alerts.push({ id: "team_sla_worsening", severity: "warning", message: `O SLA da equipe caiu mais de ${Math.round(threshold.slaWorsening * 100)}% nesta janela.`, ...unit });
  }
  if (overdue >= threshold.criticalPendingCount) {
    alerts.push({ id: "critical_pending", severity: "critical", message: `A equipe acumula ${overdue} retornos urgentes vencidos.`, ...unit });
  }
  return alerts;
}
