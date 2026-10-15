import type { TeamHealthInput } from "./health";
import type { TeamMetricTeam } from "./metrics";

/**
 * Mapeamento único das janelas do G0 para a entrada da função de saúde (teamHealthScore).
 * Usado pela visão do gestor, pela visão do supervisor e pelas previas. Não recalcula métrica: só traduz o que já foi calculado.
 */

const SAO_PAULO = "America/Sao_Paulo";
const DAY_MS = 86_400_000;

/** Data de calendário em São Paulo (YYYY-MM-DD). */
export function saoPauloDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SAO_PAULO }).format(date);
}

/** Dias úteis (seg a sex) em São Paulo depois do último movimento, até hoje. Dois ou mais = sem atividade recente. */
export function isInactiveForTwoBusinessDays(lastActivityAt: Date | null, now: Date): boolean {
  if (!lastActivityAt) return true;
  const last = saoPauloDayKey(lastActivityAt);
  const today = saoPauloDayKey(now);
  if (last >= today) return false;
  let businessDays = 0;
  const end = Date.parse(`${today}T00:00:00Z`);
  for (let day = Date.parse(`${last}T00:00:00Z`) + DAY_MS; day <= end; day += DAY_MS) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays >= 2;
}

/**
 * Entrada da saúde da equipe.
 * unitConversionRate = média de conversão da unidade (o G0 entrega para gestor e supervisor, sem dado de outra equipe).
 * Sem essa referência, a própria conversão da equipe serve de base neutra.
 */
export function teamHealthInputFor(team: TeamMetricTeam, unitConversionRate: number | null, now: Date): TeamHealthInput {
  const current = team.current;
  const brokers = team.brokers;
  return {
    slaRate: current.slaRate,
    acceptanceRate: current.acceptanceRate,
    overdueReturns: current.overdueReturns ?? 0,
    leadsWithoutNextAction: current.leadsWithoutNextAction ?? 0,
    activeLeads: current.activeLeads ?? 0,
    conversionRate: current.conversion.rate,
    unitAverageConversionRate: unitConversionRate ?? current.conversion.rate,
    redistributions: current.redistributions,
    offersReceived: current.received,
    activeBrokers: brokers.length,
    brokersActiveWithinTwoBusinessDays: brokers.filter((broker) => !isInactiveForTwoBusinessDays(broker.current.lastActivityAt, now)).length,
    brokerActiveLeads: brokers.map((broker) => broker.current.activeLeads ?? 0),
  };
}
