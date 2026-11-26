/**
 * "Lembrar se não responder" (central de conversas, inspirado na Inbox do DeskComm): um clique no ⋯ da conversa
 * cria a tarefa do lead para quem pediu, com prazo fixo. Tudo no fuso America/Sao_Paulo; domingo vira segunda.
 * Puro (roda no cliente para mostrar as opções e no servidor para gravar o prazo).
 */
import { computeTaskPresetDue, toTaskLocalInput } from "./task-presets";

export const NO_REPLY_TASK_TITLE = "Retornar: cliente não respondeu";

export const NO_REPLY_REMINDER_IDS = ["today_18", "tomorrow_9", "in_2_days"] as const;
export type NoReplyReminderId = (typeof NO_REPLY_REMINDER_IDS)[number];

type NoReplyReminder = { id: NoReplyReminderId; label: string; days: number; hour: number };

export const NO_REPLY_REMINDERS: readonly NoReplyReminder[] = [
  { id: "today_18", label: "Hoje 18h", days: 0, hour: 18 },
  { id: "tomorrow_9", label: "Amanhã 9h", days: 1, hour: 9 },
  { id: "in_2_days", label: "Em 2 dias", days: 2, hour: 9 },
];

export function isNoReplyReminderId(value: unknown): value is NoReplyReminderId {
  return typeof value === "string" && (NO_REPLY_REMINDER_IDS as readonly string[]).includes(value);
}

/** Prazo da opção a partir de `now`. Null quando o horário já passou (ex.: "Hoje 18h" depois das 18h). */
export function noReplyReminderDue(id: NoReplyReminderId, now: Date = new Date()): Date | null {
  const option = NO_REPLY_REMINDERS.find((item) => item.id === id);
  if (!option) return null;
  const due = computeTaskPresetDue({ id: option.id, label: option.label, title: NO_REPLY_TASK_TITLE, days: option.days, hour: option.hour }, now);
  return due.getTime() > now.getTime() ? due : null;
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "qui, 26/11 às 9h" na hora de São Paulo. */
export function formatNoReplyReminderDue(due: Date): string {
  const [date, time] = toTaskLocalInput(due).split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const clock = minute ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
  return `${weekday}, ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} às ${clock}`;
}

/** Opções que ainda fazem sentido agora, com o prazo calculado e o texto de apoio. */
export function noReplyReminderOptions(now: Date = new Date()) {
  return NO_REPLY_REMINDERS.flatMap((option) => {
    const due = noReplyReminderDue(option.id, now);
    return due ? [{ id: option.id, label: option.label, dueAt: due, hint: formatNoReplyReminderDue(due) }] : [];
  });
}
