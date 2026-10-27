import type { LiveStatus } from "../types";

export type DutyShiftReminderAggregate = { sent: number; noPhone: number };

export function buildDutyShiftReminderStatus(input: { aggregate: DutyShiftReminderAggregate; now: Date }): LiveStatus {
  const { sent, noPhone } = input.aggregate;
  const format = new Intl.NumberFormat("pt-BR");
  return {
    id: "duty-reminders",
    label: "Lembretes de amanhã",
    value: sent,
    valueText: `${format.format(sent)} enviados`,
    emptyText: "Nenhum lembrete enviado ainda",
    severity: noPhone ? "atencao" : "ok",
    explanation: `${format.format(noPhone)} sem telefone.`,
    breakdown: noPhone ? [{ label: "sem telefone", value: noPhone }] : undefined,
    generatedAt: input.now.toISOString(),
  };
}
