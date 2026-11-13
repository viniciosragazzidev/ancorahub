/**
 * Display formats of the ERP screens (pt-BR, São Paulo). Raw keys ("2026-11", "2026-11-05") never reach the screen.
 */
const MONTHS_SHORT = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const PERIOD = /^(\d{4})-(\d{2})$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-11" → "nov. 2026" (short, tables) or "novembro de 2026" (long, titles and filters). */
export function formatCompetence(value: string | null | undefined, style: "short" | "long" = "short") {
  const match = value ? PERIOD.exec(value) : null;
  if (!match) return value || "Sem competência";
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return value as string;
  return style === "long" ? `${MONTHS_LONG[month]} de ${match[1]}` : `${MONTHS_SHORT[month]} ${match[1]}`;
}

/** "2026-11-05" (or an ISO instant) → "05/11/2026". Instants are read in São Paulo. */
export function formatDay(value: string | Date | null | undefined, fallback = "Sem data") {
  if (!value) return fallback;
  if (typeof value === "string" && DAY.test(value) && value.length === 10) {
    const [, year, month, day] = DAY.exec(value) as RegExpExecArray;
    return `${day}/${month}/${year}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
}

/** Instant → "05/11/2026, 14:32" in São Paulo. */
export function formatInstant(value: string | Date | null | undefined, fallback = "Sem registro") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

/** Months offered by the month filter: `before` months back and `after` months ahead of `current`, newest first. */
export function competenceOptions(current: string, before = 12, after = 3) {
  const match = PERIOD.exec(current);
  if (!match) return [];
  const base = Number(match[1]) * 12 + Number(match[2]) - 1;
  const options: { value: string; label: string }[] = [];
  for (let offset = after; offset >= -before; offset -= 1) {
    const index = base + offset;
    const value = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
    options.push({ value, label: formatCompetence(value, "long").replace(/^./, (letter) => letter.toUpperCase()) });
  }
  return options;
}

/** "1 lançamento" / "3 lançamentos". */
export function plural(count: number, one: string, many: string) {
  return `${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`;
}
