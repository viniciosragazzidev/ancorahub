/**
 * The simple lead quality report (Vinicios, 13/10): to show the owner, in
 * plain numbers, how many leads arrived, how many were good (hot or warm,
 * validated), when the good ones ran out and brokers started getting cold
 * ones, and what would happen without sending cold leads. Pure: the service
 * reads the rows, this turns them into the report (and is what the tests check).
 */

/** good = hot/warm validated; cold; no_reply = WhatsApp lead marked hot/warm that never answered the qualification; other = disqualified, blocked, still qualifying. */
export type SimpleLeadClass = "good" | "cold" | "no_reply" | "other";

export type SimpleLeadRow = {
  createdAt: Date;
  /** When the lead was qualified and could be handed out (the arrival when unknown). */
  readyAt?: Date | null;
  assignedAt: Date | null;
  quality: SimpleLeadClass;
  queueName: string | null;
  brokerId: string | null;
  converted: boolean;
};

type Split = { good: number; cold: number; noReply: number; other: number };
const emptySplit = (): Split => ({ good: 0, cold: 0, noReply: 0, other: 0 });
const add = (split: Split, quality: SimpleLeadClass) => {
  if (quality === "good") split.good += 1;
  else if (quality === "cold") split.cold += 1;
  else if (quality === "no_reply") split.noReply += 1;
  else split.other += 1;
};
/** Leads a broker would not want: cold plus WhatsApp leads that never answered. */
const weak = (split: Split) => split.cold + split.noReply;

export type SimpleHour = {
  /** "09h" or "13/10 09h". */
  label: string;
  startsAt: string;
  arrived: Split;
  distributed: Split;
  /** Good leads already arrived and not yet handed out at the end of the hour (only on a timeline of one or two days). */
  goodWaiting: number | null;
};

export type SimpleShift = {
  key: 1 | 2;
  label: string;
  distributedGood: number;
  distributedWeak: number;
  brokers: number;
};

export type SimpleQualityReport = {
  arrived: Split & { total: number };
  distributed: Split & { total: number };
  brokers: number;
  converted: { good: number; weak: number };
  byQueue: Array<{
    queue: string; arrived: number; good: number; weak: number; distributed: number; distributedWeak: number;
    /** When this queue had no qualified good lead left while weak ones went out (timeline only). */
    goodRanOut: string | null;
    /** Weak leads handed out while a qualified good lead of the same queue was waiting. */
    weakWhileGoodWaiting: number;
  }>;
  hours: SimpleHour[];
  /** Hours are a real timeline (short period) or an average day (hour of day, longer period). */
  hourly: "timeline" | "hour_of_day";
  /** First hour when no good lead was waiting and weak ones were handed out. */
  goodRanOut: { label: string } | null;
  shifts: SimpleShift[];
  withoutWeak: { distributed: number; removed: number; removedShare: number; perBrokerNow: number | null; perBrokerWithout: number | null };
};

const TIME_ZONE = "America/Sao_Paulo";
const hourFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", hourCycle: "h23" });
const dayHourFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", hourCycle: "h23" });
const HOUR = 3_600_000;

function share(part: number, total: number) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Hour of day (0-23) in São Paulo. */
function localHour(date: Date) {
  return Number(hourFormat.format(date));
}

export function buildSimpleQualityReport(rows: SimpleLeadRow[], window: { since: Date; until: Date | null; shiftSplit?: Date }, now = new Date()): SimpleQualityReport {
  const end = window.until ?? now;
  const arrived = emptySplit();
  const distributed = emptySplit();
  const brokers = new Set<string>();
  const converted = { good: 0, weak: 0 };
  const queues = new Map<string, { arrived: number; good: number; weak: number; distributed: number; distributedWeak: number }>();

  for (const row of rows) {
    add(arrived, row.quality);
    const queue = queues.get(row.queueName ?? "Sem fila") ?? { arrived: 0, good: 0, weak: 0, distributed: 0, distributedWeak: 0 };
    queue.arrived += 1;
    if (row.quality === "good") queue.good += 1;
    if (row.quality === "cold" || row.quality === "no_reply") queue.weak += 1;
    if (row.assignedAt && row.assignedAt <= end) {
      add(distributed, row.quality);
      queue.distributed += 1;
      if (row.quality === "cold" || row.quality === "no_reply") queue.distributedWeak += 1;
      if (row.brokerId) brokers.add(row.brokerId);
    }
    queues.set(row.queueName ?? "Sem fila", queue);
    if (row.converted) {
      if (row.quality === "good") converted.good += 1;
      else if (row.quality === "cold" || row.quality === "no_reply") converted.weak += 1;
    }
  }

  // Hours: a real timeline for up to two days, an average day (by hour of day) for longer periods.
  const timeline = end.getTime() - window.since.getTime() <= 48 * HOUR;
  const hours: SimpleHour[] = [];
  if (timeline) {
    const first = new Date(Math.floor(window.since.getTime() / HOUR) * HOUR);
    for (let start = first.getTime(); start < end.getTime(); start += HOUR) {
      const hourEnd = start + HOUR;
      const bucket: SimpleHour = { label: dayHourFormat.format(new Date(start)).replace(", ", " ") + "h", startsAt: new Date(start).toISOString(), arrived: emptySplit(), distributed: emptySplit(), goodWaiting: 0 };
      for (const row of rows) {
        const created = row.createdAt.getTime();
        if (created >= start && created < hourEnd) add(bucket.arrived, row.quality);
        if (row.assignedAt && row.assignedAt.getTime() >= start && row.assignedAt.getTime() < hourEnd) add(bucket.distributed, row.quality);
        // Waiting = already qualified (ready) and not handed out yet: a lead still in qualification cannot go.
        const ready = (row.readyAt ?? row.createdAt).getTime();
        if (row.quality === "good" && ready < hourEnd && (!row.assignedAt || row.assignedAt.getTime() >= hourEnd)) bucket.goodWaiting = (bucket.goodWaiting ?? 0) + 1;
      }
      if (weak(bucket.arrived) + bucket.arrived.good + weak(bucket.distributed) + bucket.distributed.good > 0) hours.push(bucket);
    }
    const singleDay = new Set(hours.map((hour) => hour.label.slice(0, 5))).size <= 1;
    if (singleDay) for (const hour of hours) hour.label = hour.label.slice(6);
  } else {
    for (let hour = 0; hour < 24; hour += 1) {
      const bucket: SimpleHour = { label: `${String(hour).padStart(2, "0")}h`, startsAt: String(hour), arrived: emptySplit(), distributed: emptySplit(), goodWaiting: null };
      for (const row of rows) {
        if (localHour(row.createdAt) === hour) add(bucket.arrived, row.quality);
        if (row.assignedAt && row.assignedAt <= end && localHour(row.assignedAt) === hour) add(bucket.distributed, row.quality);
      }
      if (weak(bucket.arrived) + bucket.arrived.good + weak(bucket.distributed) + bucket.distributed.good > 0) hours.push(bucket);
    }
  }
  const ranOut = timeline ? hours.find((hour) => hour.goodWaiting === 0 && weak(hour.distributed) > 0) : null;

  // Shifts: by when the lead was handed out (13:30 splits the day; a range splits at 13:30 of its last day).
  const shiftOf = (date: Date) => {
    if (window.shiftSplit) return date < window.shiftSplit ? 1 : 2;
    const local = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date).replace(":", ""));
    return local >= 1330 && local < 1900 ? 2 : 1;
  };
  const shifts: SimpleShift[] = ([1, 2] as const).map((key) => {
    const handed = rows.filter((row) => row.assignedAt && row.assignedAt <= end && shiftOf(row.assignedAt) === key);
    return {
      key,
      label: key === 1 ? "Turno 1 (até 13h30)" : "Turno 2 (13h30 às 19h)",
      distributedGood: handed.filter((row) => row.quality === "good").length,
      distributedWeak: handed.filter((row) => row.quality === "cold" || row.quality === "no_reply").length,
      brokers: new Set(handed.map((row) => row.brokerId).filter(Boolean)).size,
    };
  });

  const distributedTotal = distributed.good + distributed.cold + distributed.noReply + distributed.other;
  const removed = weak(distributed);
  return {
    arrived: { ...arrived, total: rows.length },
    distributed: { ...distributed, total: distributedTotal },
    brokers: brokers.size,
    converted,
    byQueue: [...queues.entries()].map(([queue, values]) => {
      const queueRows = rows.filter((row) => (row.queueName ?? "Sem fila") === queue);
      return { queue, ...values, goodRanOut: timeline ? firstRunOut(queueRows, window.since, end) : null, weakWhileGoodWaiting: weakSentWhileGoodWaiting(queueRows, end) };
    }).sort((a, b) => b.arrived - a.arrived),
    hours,
    hourly: timeline ? "timeline" : "hour_of_day",
    goodRanOut: ranOut ? { label: ranOut.label } : null,
    shifts,
    withoutWeak: {
      distributed: distributedTotal - removed,
      removed,
      removedShare: share(removed, distributedTotal),
      perBrokerNow: brokers.size ? Math.round((distributedTotal / brokers.size) * 10) / 10 : null,
      perBrokerWithout: brokers.size ? Math.round(((distributedTotal - removed) / brokers.size) * 10) / 10 : null,
    },
  };
}

const isWeak = (quality: SimpleLeadClass) => quality === "cold" || quality === "no_reply";

/** First hour (of a short timeline) with no qualified good lead waiting and a weak one handed out. */
function firstRunOut(rows: SimpleLeadRow[], since: Date, end: Date) {
  const first = Math.floor(since.getTime() / HOUR) * HOUR;
  for (let start = first; start < end.getTime(); start += HOUR) {
    const hourEnd = start + HOUR;
    const weakOut = rows.some((row) => isWeak(row.quality) && row.assignedAt && row.assignedAt.getTime() >= start && row.assignedAt.getTime() < hourEnd);
    if (!weakOut) continue;
    const waiting = rows.some((row) => row.quality === "good" && (row.readyAt ?? row.createdAt).getTime() < hourEnd && (!row.assignedAt || row.assignedAt.getTime() >= hourEnd));
    if (!waiting) return dayHourFormat.format(new Date(start)).replace(", ", " ") + "h";
  }
  return null;
}

/** Weak leads handed out while a qualified good lead of the same queue was already waiting (and went later or never). */
function weakSentWhileGoodWaiting(rows: SimpleLeadRow[], end: Date) {
  const good = rows.filter((row) => row.quality === "good");
  return rows.filter((row) => isWeak(row.quality) && row.assignedAt && row.assignedAt <= end && good.some((lead) => (lead.readyAt ?? lead.createdAt) < row.assignedAt! && (!lead.assignedAt || lead.assignedAt > row.assignedAt!))).length;
}

