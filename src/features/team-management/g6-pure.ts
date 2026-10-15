import type { TeamMetricBroker, TeamMetricWindow } from "./metrics";

export type WeeklyHighlightCategory = "conversion" | "sla" | "evolution" | "redistributions";

export type WeeklyHighlight = {
  category: WeeklyHighlightCategory;
  label: string;
  brokerId: string;
  brokerName: string;
  value: string;
};

export type JourneyPositionChange = { brokerId: string; positionChange: number | null };

const numberPt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function winner<T extends { id: string; name: string }>(
  rows: readonly T[],
  score: (row: T) => number,
  higherIsBetter: boolean,
): T | null {
  return [...rows].sort((a, b) => {
    const difference = score(a) - score(b);
    return (higherIsBetter ? -difference : difference) || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id);
  })[0] ?? null;
}

/** Destaques puros; a lista recebida ja foi limitada ao escopo e ao ranking_opt_out no servidor. */
export function buildWeeklyHighlights(
  brokers: readonly TeamMetricBroker[],
  journeyMovements: readonly JourneyPositionChange[],
): WeeklyHighlight[] {
  const rows: WeeklyHighlight[] = [];
  const conversion = winner(brokers.filter((broker) => broker.current.conversion.received > 0), (broker) => broker.current.conversion.rate, true);
  if (conversion) rows.push({ category: "conversion", label: "Maior conversão", brokerId: conversion.id, brokerName: conversion.name, value: `${numberPt.format(conversion.current.conversion.rate)}%` });

  const sla = winner(brokers.filter((broker) => broker.current.slaLeads > 0), (broker) => broker.current.slaRate, true);
  if (sla) rows.push({ category: "sla", label: "Melhor SLA", brokerId: sla.id, brokerName: sla.name, value: `${numberPt.format(sla.current.slaRate)}%` });

  const movements = new Map(journeyMovements.map((movement) => [movement.brokerId, movement.positionChange]));
  const evolution = winner(brokers.filter((broker) => (movements.get(broker.id) ?? 0) > 0), (broker) => movements.get(broker.id) ?? 0, true);
  if (evolution) rows.push({ category: "evolution", label: "Maior evolução", brokerId: evolution.id, brokerName: evolution.name, value: `${movements.get(evolution.id)} posições no ranking da jornada` });

  const redistributions = winner(brokers.filter((broker) => broker.current.received > 0), (broker) => broker.current.redistributions, false);
  if (redistributions) rows.push({ category: "redistributions", label: "Menos redistribuições", brokerId: redistributions.id, brokerName: redistributions.name, value: `${redistributions.current.redistributions} redistribuições` });
  return rows;
}

export type WeeklySummaryValues = Pick<TeamMetricWindow, "received" | "accepted" | "acceptanceRate" | "slaRate"> & {
  leadsReceived: number;
  conversionRate: number;
  highlights: WeeklyHighlight[];
};

export function weeklySummaryValues(window: TeamMetricWindow, highlights: WeeklyHighlight[]): WeeklySummaryValues {
  return {
    received: window.received,
    accepted: window.accepted,
    acceptanceRate: window.acceptanceRate,
    slaRate: window.slaRate,
    leadsReceived: window.conversion.received,
    conversionRate: window.conversion.rate,
    highlights,
  };
}

export type BrokerMetricSnapshotLike = {
  snapshotDay: string;
  metrics: Record<string, number | string | null>;
};

export type MonthlyBrokerMetricPoint = {
  month: string;
  conversionRate: number | null;
  leadsReceived: number | null;
  leadsConverted: number | null;
};

/** Uses the last daily canonical snapshot in each month; no metric is recalculated in the UI. */
export function monthlyBrokerMetricTimeline(rows: readonly BrokerMetricSnapshotLike[]): MonthlyBrokerMetricPoint[] {
  const latestByMonth = new Map<string, BrokerMetricSnapshotLike>();
  for (const row of [...rows].sort((a, b) => a.snapshotDay.localeCompare(b.snapshotDay))) {
    latestByMonth.set(row.snapshotDay.slice(0, 7), row);
  }
  return [...latestByMonth.entries()].map(([month, row]) => ({
    month,
    conversionRate: metricNumber(row.metrics["commercial.conversion_rate"]),
    leadsReceived: metricNumber(row.metrics["commercial.leads_received"]),
    leadsConverted: metricNumber(row.metrics["commercial.leads_converted"]),
  }));
}

function metricNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const saoPauloParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hourCycle: "h23",
});

export function saoPauloDayKey(now: Date): string {
  const parts = saoPauloParts.formatToParts(now);
  const part = (key: string) => parts.find((entry) => entry.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isMondayMorningInSaoPaulo(now: Date): boolean {
  const parts = saoPauloParts.formatToParts(now);
  const part = (key: string) => parts.find((entry) => entry.type === key)!.value;
  return part("weekday") === "Mon" && Number(part("hour")) === 8;
}

export function isNightlySnapshotWindowInSaoPaulo(now: Date): boolean {
  const hour = Number(saoPauloParts.formatToParts(now).find((entry) => entry.type === "hour")!.value);
  return hour === 2;
}

export function isMissingBrokerMetricDailyTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const item = error as { code?: unknown; cause?: { code?: unknown } };
  return item.code === "42P01" || item.cause?.code === "42P01";
}

export async function runG6LockedWork<T>(acquire: () => Promise<boolean>, work: () => Promise<T>): Promise<{ skipped: true } | { skipped: false; value: T }> {
  if (!(await acquire())) return { skipped: true };
  return { skipped: false, value: await work() };
}

export function brokerMetricsFromRows(brokers: readonly TeamMetricBroker[], ids: readonly string[]): TeamMetricBroker[] {
  const allowed = new Set(ids);
  return brokers.filter((broker) => allowed.has(broker.id));
}
