import type { BrokerWorkspacePriority } from "./priority";

const TIME_ZONE = "America/Sao_Paulo";

function dateKeyInSaoPaulo(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function saoPauloMidnight(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(candidate));
    const value = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const localAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
    const correction = target - localAsUtc;
    candidate += correction;
    if (correction === 0) break;
  }
  return new Date(candidate);
}

function addCalendarDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export function getSaoPauloDayBounds(now: Date) {
  const today = dateKeyInSaoPaulo(now);
  return { start: saoPauloMidnight(today), end: saoPauloMidnight(addCalendarDay(today)) };
}

export type BrokerWorkspaceTodayCounts = {
  receivedToday: number | string | null;
  acceptedToday: number | string | null;
  inServiceNow: number | string | null;
};

export function buildBrokerWorkspaceTodayMetrics(counts: BrokerWorkspaceTodayCounts, priorities: readonly BrokerWorkspacePriority[]) {
  const count = (value: number | string | null) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  };
  return {
    receivedToday: count(counts.receivedToday),
    acceptedToday: count(counts.acceptedToday),
    inServiceNow: count(counts.inServiceNow),
    slaAtRiskNow: new Set(priorities
      .filter((priority) => priority.kind === "sla_risk" || priority.kind === "sla_overdue")
      .map((priority) => priority.leadId)).size,
  };
}

export function isBrokerReadyToReceive(input: {
  availabilityStatus: "available" | "paused" | "offline";
  paused: boolean;
  presenceStatus: "confirmed" | "pending" | "not_required";
}) {
  return input.availabilityStatus === "available"
    && !input.paused
    && input.presenceStatus !== "pending";
}
