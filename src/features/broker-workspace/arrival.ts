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
