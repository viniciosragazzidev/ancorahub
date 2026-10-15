import type { BrokerPerformanceView } from "@/features/supervisor-workspace/broker-profile/supervisor-broker-profile";
import type { TeamMetricBroker } from "@/features/team-management/metrics";
import { compareTrend } from "@/features/team-management/trend";
import { formatDuration } from "@/features/engagement/ranking";

function trend(current: number | null, previous: number | null, higherIsBetter: boolean) {
  if (current === null || previous === null) return null;
  return compareTrend({ current, previous, higherIsBetter }).direction;
}

const formatPercent = (value: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "%";
const formatCount = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

/** Pure projection of a scoped G0 broker row into the profile's performance section. */
export function buildBrokerPerformanceView(
  broker: TeamMetricBroker | null,
  input: { window: 7 | 30; teamMedianAcceptSeconds: number | null },
): BrokerPerformanceView | null {
  if (!broker) return null;
  const { current, previous } = broker;
  return {
    window: input.window,
    teamMedianAcceptSeconds: input.teamMedianAcceptSeconds,
    items: [
      { key: "accepted", label: "Aceites", value: formatCount(current.accepted), trend: trend(current.accepted, previous.accepted, true), better: "up" },
      { key: "accept-time", label: "Tempo mediano para aceitar", value: formatDuration(current.medianAcceptanceSeconds), trend: trend(current.medianAcceptanceSeconds, previous.medianAcceptanceSeconds, false), better: "down" },
      { key: "on-time", label: "Primeiro contato no prazo", value: formatPercent(current.slaRate), trend: trend(current.slaRate, previous.slaRate, true), better: "up" },
      { key: "redistributions", label: "Redistribuições", value: formatCount(current.redistributions), trend: trend(current.redistributions, previous.redistributions, false), better: "down" },
      { key: "quotes", label: "Cotações", value: formatCount(current.quotes), trend: trend(current.quotes, previous.quotes, true), better: "up" },
      { key: "sales", label: "Vendas", value: formatCount(current.sales), trend: trend(current.sales, previous.sales, true), better: "up" },
      { key: "conversion", label: "Conversão", value: formatPercent(current.conversion.rate), trend: trend(current.conversion.rate, previous.conversion.rate, true), better: "up" },
      { key: "losses", label: "Perdas", value: formatCount(current.losses), trend: trend(current.losses, previous.losses, false), better: "down" },
    ],
  };
}

export function normalizeBrokerPerformanceWindow(value: string | string[] | undefined): 7 | 30 {
  return value === "30" || (Array.isArray(value) && value.includes("30")) ? 30 : 7;
}
