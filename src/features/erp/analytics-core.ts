import { ErpError } from "./contracts";

/** Pure analytics helpers: calendar in America/Sao_Paulo, YoY and BigInt-safe sums. No I/O. */
export const ANALYTICS_TIME_ZONE = "America/Sao_Paulo";
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

function localParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ANALYTICS_TIME_ZONE }).formatToParts(now);
  const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === key)?.value ?? "";
  return { year: part("year"), month: part("month"), day: part("day") };
}

/** Calendar month (YYYY-MM) of an instant in São Paulo. */
export function monthKey(now: Date = new Date()) {
  const { year, month } = localParts(now);
  return `${year}-${month}`;
}

/** Calendar day (YYYY-MM-DD) of an instant in São Paulo. */
export function dayKey(now: Date = new Date()) {
  const { year, month, day } = localParts(now);
  return `${year}-${month}-${day}`;
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH.test(value);
}

export function shiftMonth(month: string, delta: number) {
  const match = MONTH.exec(month);
  if (!match) throw new ErpError("Informe um mês válido.");
  const index = Number(match[1]) * 12 + Number(match[2]) - 1 + delta;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Inclusive list of months from `from` to `to`; refuses inverted or oversized ranges. */
export function monthRange(from: string, to: string, max = 36) {
  if (!isMonth(from) || !isMonth(to)) throw new ErpError("Informe um período válido.");
  if (from > to) throw new ErpError("O mês inicial precisa ser anterior ao final.");
  const months: string[] = [];
  for (let current = from; current <= to; current = shiftMonth(current, 1)) {
    months.push(current);
    if (months.length > max) throw new ErpError(`Consulte no máximo ${max} meses por vez.`);
  }
  return months;
}

export function daysOfMonth(month: string) {
  const match = MONTH.exec(month);
  if (!match) throw new ErpError("Informe um mês válido.");
  const total = new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
  return Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

/** The month is still running (or in the future) relative to `now` in São Paulo. */
export function isPartialMonth(month: string, now: Date = new Date()) {
  return month >= monthKey(now);
}

/** Exact sum of integer cents; throws instead of losing precision. */
export function sumCents(values: readonly (string | number | bigint)[]) {
  const total = values.reduce<bigint>((acc, value) => acc + toBigCents(value), BigInt(0));
  return safeCents(total);
}

function toBigCents(value: string | number | bigint) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new ErpError("Valor indisponível para conferência.");
    return BigInt(value);
  }
  if (!/^-?\d+$/.test(value.trim())) throw new ErpError("Valor indisponível para conferência.");
  return BigInt(value.trim());
}

export function safeCents(value: bigint) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || BigInt(result) !== value) throw new ErpError("O total excede o limite seguro de conferência.");
  return result;
}

/** Decimal text with up to two places (Postgres numeric) to integer cents, without floating point. */
export function decimalToCents(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const match = /^(-?)(\d+)(?:\.(\d{1,2})\d*)?$/.exec(value.trim());
  if (!match) return null;
  const cents = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0"));
  return safeCents(match[1] ? -cents : cents);
}

/** Year-over-year change in basis points (1% = 100). Unavailable when there is no positive base. */
export function yoyBasisPoints(current: number | null | undefined, previous: number | null | undefined): number | null {
  if (current === null || current === undefined || previous === null || previous === undefined || previous <= 0) return null;
  return Number(((BigInt(current) - BigInt(previous)) * BigInt(10000)) / BigInt(previous));
}

/** Share of a total in basis points; zero total yields null instead of a division by zero. */
export function shareBasisPoints(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Number((BigInt(part) * BigInt(10000)) / BigInt(total));
}

export function formatBasisPoints(value: number | null, signed = false) {
  if (value === null) return "—";
  const text = (value / 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return signed && value > 0 ? `+${text}%` : `${text}%`;
}

/** Fills missing buckets with zero for the keys requested, keeping order. */
export function fillBuckets<T extends Record<string, number>>(keys: readonly string[], rows: readonly ({ key: string } & Partial<T>)[], empty: T) {
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return keys.map((key) => ({ ...empty, ...(byKey.get(key) ?? {}), key }));
}

export function monthLabel(month: string) {
  const match = MONTH.exec(month);
  if (!match) return month;
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15)));
  const clean = label.replace(".", "");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: ANALYTICS_TIME_ZONE }).format(new Date(iso));
}
