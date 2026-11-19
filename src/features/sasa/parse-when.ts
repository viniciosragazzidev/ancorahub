/**
 * Datas e horas faladas em português ("amanhã às 10", "sexta de tarde", "daqui a 2 horas"), no fuso de
 * São Paulo. Puro e testável: o modelo de IA nunca calcula data (plano 2026-11-19-sasa-agentica.md §3.1).
 * O Brasil não tem horário de verão desde 2019, então o fuso é fixo em -03:00.
 */
const SP_OFFSET_MINUTES = -180;
const TIME_ZONE = "America/Sao_Paulo";

export type ParsedWhen = { at: Date; hasTime: boolean };

/** Sem acento e em minúsculas: "Amanhã às 10" → "amanha as 10". */
export function normalizePtBr(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function spParts(date: Date) {
  const shifted = new Date(date.getTime() + SP_OFFSET_MINUTES * 60_000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

function spDate(year: number, month: number, day: number, hour: number, minute: number) {
  return new Date(Date.UTC(year, month, day, hour, minute) - SP_OFFSET_MINUTES * 60_000);
}

const WEEKDAYS: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
const NUMBER_WORDS: Record<string, number> = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, dez: 10, quinze: 15, vinte: 20, trinta: 30, quarenta: 40 };

function amount(word: string) {
  return /^\d+$/.test(word) ? Number(word) : NUMBER_WORDS[word] ?? null;
}

type Clock = { hour: number; minute: number };

/** Hora dita: "10:30", "10h", "10h30", "às 3 da tarde", "meio-dia", "de manhã". */
function readClock(text: string): Clock | null {
  const period = /\b(?:da|de|a)\s+tarde\b/.test(text) ? "tarde" : /\b(?:da|de|a)\s+noite\b/.test(text) ? "noite" : /\b(?:da|de|pela)\s+manha\b/.test(text) ? "manha" : null;
  if (/\bmeio[\s-]?dia\b/.test(text)) return { hour: 12, minute: /\bmeio[\s-]?dia e meia\b/.test(text) ? 30 : 0 };
  const match = text.match(/\b(\d{1,2}):(\d{2})\b/)
    ?? text.match(/\b(\d{1,2})\s*h(?:oras?)?(?:\s*e?\s*(\d{2}))?\b/)
    ?? text.match(/\bas\s+(\d{1,2})(?:\s+e\s+(meia|\d{2}))?\b/);
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2] === "meia" ? 30 : match[2] ? Number(match[2]) : 0;
    if (hour > 23 || minute > 59) return null;
    if ((period === "tarde" || period === "noite") && hour < 12) hour += 12;
    // "às 3" sem período: horário comercial, então é de tarde.
    else if (!period && hour >= 1 && hour <= 7) hour += 12;
    return { hour, minute };
  }
  if (period === "manha") return { hour: 9, minute: 0 };
  if (period === "tarde") return { hour: 14, minute: 0 };
  if (period === "noite") return { hour: 19, minute: 0 };
  return null;
}

/** Interpreta a data e a hora de uma frase. null quando a frase não diz quando. */
export function parseWhenPtBr(input: string, now: Date): ParsedWhen | null {
  let text = normalizePtBr(input);
  const relative = text.match(/\b(?:daqui a|daqui|em|dentro de)\s+(meia|\d{1,3}|[a-z]+)\s*(hora|horas|h|minuto|minutos|min)\b/);
  if (relative) {
    const value = relative[1] === "meia" ? 0.5 : amount(relative[1]!);
    if (value !== null) {
      const minutes = relative[2]!.startsWith("h") ? value * 60 : value;
      return { at: new Date(now.getTime() + minutes * 60_000), hasTime: true };
    }
  }
  const today = spParts(now);
  let base: { year: number; month: number; day: number } | null = null;
  const addDays = (days: number) => {
    const at = spDate(today.year, today.month, today.day + days, 12, 0);
    const parts = spParts(at);
    return { year: parts.year, month: parts.month, day: parts.day };
  };

  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  const dayOfMonth = text.match(/\bdia\s+(\d{1,2})\b/);
  const weekday = text.match(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/);
  if (/\bdepois de amanha\b/.test(text)) base = addDays(2);
  else if (/\bamanha\b/.test(text)) base = addDays(1);
  else if (/\bhoje\b/.test(text)) base = addDays(0);
  else if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]) - 1;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const thisYear = spDate(today.year, month, day, 23, 59);
    base = { year: thisYear.getTime() < now.getTime() ? today.year + 1 : today.year, month, day };
    text = text.replace(slash[0], " ");
  } else if (dayOfMonth) {
    const day = Number(dayOfMonth[1]);
    if (day < 1 || day > 31) return null;
    base = day >= today.day ? { year: today.year, month: today.month, day } : { year: today.month === 11 ? today.year + 1 : today.year, month: (today.month + 1) % 12, day };
    text = text.replace(dayOfMonth[0], " ");
  } else if (weekday) {
    const target = WEEKDAYS[weekday[1]!]!;
    base = addDays(((target - today.weekday + 7) % 7) || 7);
  }

  const clock = readClock(text);
  if (!base && !clock) return null;
  if (!base) {
    // Só a hora: hoje, ou amanhã se essa hora já passou.
    const todayAt = spDate(today.year, today.month, today.day, clock!.hour, clock!.minute);
    return { at: todayAt.getTime() > now.getTime() ? todayAt : spDate(today.year, today.month, today.day + 1, clock!.hour, clock!.minute), hasTime: true };
  }
  if (clock) return { at: spDate(base.year, base.month, base.day, clock.hour, clock.minute), hasTime: true };
  // Só o dia: hoje às 18h (como o atalho "hoje"), outro dia às 9h.
  const isToday = base.year === today.year && base.month === today.month && base.day === today.day;
  return { at: spDate(base.year, base.month, base.day, isToday ? 18 : 9, 0), hasTime: false };
}

const hhmm = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

/** "hoje às 10:00", "amanhã às 09:00", "sex., 21/11 às 14:00". */
export function whenLabel(at: Date, now: Date) {
  const day = spParts(at);
  const today = spParts(now);
  const tomorrow = spParts(new Date(now.getTime() + 86_400_000));
  const same = (a: typeof day, b: typeof day) => a.year === b.year && a.month === b.month && a.day === b.day;
  if (same(day, today)) return `hoje às ${hhmm(at)}`;
  if (same(day, tomorrow)) return `amanhã às ${hhmm(at)}`;
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short", day: "2-digit", month: "2-digit" }).format(at);
  return `${date} às ${hhmm(at)}`;
}

export function clockLabel(at: Date) {
  return hhmm(at);
}
