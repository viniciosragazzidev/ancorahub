import { businessMillisecondsBetween, isWithinBusinessHours, scheduleForBusinessHours, type BusinessCalendarOptions } from "@/shared/time/business-hours";

/**
 * Calendário do pós-venda (09/11): seg a sex, 08h às 18h em São Paulo, sem os feriados de
 * `shared/time/holidays.ts`. Vale para a régua (atrasos e envio), a R0 (minutos de espera, horário e
 * escalada) e os lembretes. Outras áreas seguem com o calendário só de fins de semana.
 */
export const POST_SALE_CALENDAR: BusinessCalendarOptions = { skipHolidays: true };

export function isPostSaleBusinessHours(now: Date) {
  return isWithinBusinessHours(now, POST_SALE_CALENDAR);
}

/** O próprio instante quando aberto; senão a próxima abertura (dia útil, 08h). */
export function nextPostSaleBusinessOpening(now: Date) {
  return scheduleForBusinessHours(now, POST_SALE_CALENDAR);
}

export function postSaleBusinessMillisecondsBetween(start: Date, end: Date) {
  return businessMillisecondsBetween(start, end, POST_SALE_CALENDAR);
}

/**
 * Minutos úteis de espera da R0 com feriados. O "cliente aguardando" (outra área) conta só fins de
 * semana; aqui o relógio é recalculado a partir do mesmo início (`clockStartedAt`) no calendário do pós-venda.
 */
export function r0WaitingBusinessMinutes(assessment: { clockStartedAt: string; waitingBusinessMinutes: number }, now: Date) {
  const start = Date.parse(assessment.clockStartedAt);
  if (!Number.isFinite(start)) return assessment.waitingBusinessMinutes;
  if (start >= now.getTime()) return 0;
  return Math.floor(postSaleBusinessMillisecondsBetween(new Date(start), now) / 60_000);
}
