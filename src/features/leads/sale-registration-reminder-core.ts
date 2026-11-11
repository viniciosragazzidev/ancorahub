/**
 * Lembrete de registrar a venda (11/11, pedido do Vinicios, caso Andrea / Carlos Eduardo): o lead
 * foi para Convertido (pela IA ou pelo corretor) e a venda não foi registrada. O corretor recebe
 * no app e no push um lembrete 1, 3 e 5 dias depois da conversão, com o que falta; para assim que
 * a venda é registrada. Regras puras, sem I/O.
 */
export const SALE_REMINDER_MAX = 3;
/** Dias depois da conversão em que cada lembrete vence: 1, 3 e 5. */
export const SALE_REMINDER_DAYS = [1, 3, 5] as const;
const DAY = 24 * 60 * 60_000;

/** O número do próximo lembrete (1 a 3) se ele já venceu; null quando ainda não é hora ou já foram os três. */
export function saleReminderDue(convertedAt: Date, alreadySent: number, now: Date): number | null {
  if (alreadySent >= SALE_REMINDER_MAX) return null;
  const dueDays = SALE_REMINDER_DAYS[alreadySent];
  return now.getTime() - convertedAt.getTime() >= dueDays * DAY ? alreadySent + 1 : null;
}

/** Uma chave por lead e lembrete: a notificação é única por chave, então nunca sai duas vezes. */
export function saleReminderKey(leadId: string, reminder: number) {
  return `lead-sale-reminder:${leadId}:${reminder}`;
}

export const SALE_REMINDER_KEY_PREFIX = "lead-sale-reminder:";

/** Lembrete só em horário comercial de São Paulo (9h às 19h), para não acordar o corretor. */
export function isSaleReminderHour(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour >= 9 && hour < 19;
}

export function saleReminderNotice(leadName: string | null, reminder: number, missing: readonly string[] = []) {
  const lead = leadName?.trim() || "seu cliente";
  const todo = missing.length
    ? `Falta no CRM: ${missing.join(", ")}.`
    : "Confira os dados e toque em Registrar venda.";
  const last = reminder >= SALE_REMINDER_MAX ? " Este é o último lembrete." : "";
  return {
    title: `Registre a venda de ${lead}`,
    message: `Parabéns pela venda! Ela ainda não foi registrada. ${todo}${last}`,
    pushTitle: "Falta registrar a venda 📝",
    pushBody: `A venda de ${lead} ainda não foi registrada. ${todo}`,
  };
}
