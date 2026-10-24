import { LEAD_QUALITY_TIMEZONE, operationDayStart } from "@/features/reports/metrics/lead-quality-period";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sábado e domingo no fuso da operação: a janela do "dia" não conta fim de semana. */
export function isWeekendInZone(date: Date, timeZone = LEAD_QUALITY_TIMEZONE): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return weekday === "Sat" || weekday === "Sun";
}

/**
 * Início (19h de São Paulo) da janela do dia de operação. `daysBack` recua dias úteis:
 * 0 é o turno atual; na segunda, o turno anterior é sexta 19h. Sábado e domingo nunca iniciam a janela.
 */
export function businessTurnStart(now: Date, daysBack = 0): Date {
  let start = operationDayStart(now);
  for (let step = 0; step < daysBack; step += 1) start = new Date(start.getTime() - DAY_MS);
  while (isWeekendInZone(start)) start = new Date(start.getTime() - DAY_MS);
  return start;
}

/** Dias úteis incluídos num período de N dias (hoje conta como o último). */
export function businessDaysBack(periodDays: number): number {
  return Math.max(0, periodDays - 1);
}

/** Rótulo curto da janela para o cabeçalho do bloco, ex.: "desde sex 19h". */
export function windowLabel(start: Date, timeZone = LEAD_QUALITY_TIMEZONE): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "short" }).format(start).replace(".", "");
  return `desde ${weekday} 19h`;
}
