const TIME_ZONE = "America/Sao_Paulo";

function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/** The broker sees when the lead was distributed to them, never when it entered the brokerage. */
export function formatBrokerArrival(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;

  const daysAgo = Math.round((dayNumber(dateKey(now)) - dayNumber(dateKey(date))) / 86_400_000);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  if (daysAgo === 0) return `hoje ${time}`;
  if (daysAgo === 1) return `ontem ${time}`;
  if (daysAgo > 1 && daysAgo < 7) return `há ${daysAgo} dias`;
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
  return `em ${dayMonth} · há ${daysAgo} dias`;
}

export function isBrokerArrivalToday(value: Date | string | null | undefined, now = new Date()) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) && dateKey(date) === dateKey(now);
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Day separator of a broker list (São Paulo calendar): "Hoje", "Ontem", then
 * "18/10 (sáb)". Leads without a distribution time fall under "Sem data".
 */
export function arrivalDayLabel(value: Date | string | null | undefined, now = new Date()) {
  const date = toDate(value);
  if (!date) return "Sem data";
  const daysAgo = Math.round((dayNumber(dateKey(now)) - dayNumber(dateKey(date))) / 86_400_000);
  if (daysAgo === 0) return "Hoje";
  if (daysAgo === 1) return "Ontem";
  const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit" }).format(date);
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short" }).format(date).replace(".", "");
  return `${dayMonth} (${weekday})`;
}

export type ArrivalDayGroup<T> = { key: string; label: string; items: T[] };

/**
 * Orders by arrival to the broker (offer or acceptance time), newest first, and
 * splits by day. No priority or score: the broker reads the list as it came
 * (corretores, 21/10). Leads without a time go last; ties keep the name order.
 */
export function groupByArrivalDay<T>(
  items: readonly T[],
  arrivedAt: (item: T) => Date | string | null | undefined,
  now = new Date(),
  nameOf?: (item: T) => string,
): ArrivalDayGroup<T>[] {
  const sorted = items
    .map((item) => ({ item, date: toDate(arrivedAt(item)) }))
    .sort((left, right) => {
      const a = left.date?.getTime();
      const b = right.date?.getTime();
      if (a !== undefined && b !== undefined && a !== b) return b - a;
      if (a === undefined && b !== undefined) return 1;
      if (b === undefined && a !== undefined) return -1;
      return nameOf ? nameOf(left.item).localeCompare(nameOf(right.item), "pt-BR") : 0;
    });
  const groups: ArrivalDayGroup<T>[] = [];
  for (const { item, date } of sorted) {
    const key = date ? dateKey(date) : "sem-data";
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: arrivalDayLabel(date, now), items: [item] });
  }
  return groups;
}
