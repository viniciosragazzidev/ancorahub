import { describe, expect, it } from "vitest";

import { formatNoReplyReminderDue, isNoReplyReminderId, NO_REPLY_REMINDERS, NO_REPLY_TASK_TITLE, noReplyReminderDue, noReplyReminderOptions } from "./no-reply-reminder";

describe("lembrar se não responder", () => {
  it("tem as três opções e o título da tarefa, sem travessão", () => {
    expect(NO_REPLY_REMINDERS.map((item) => item.label)).toEqual(["Hoje 18h", "Amanhã 9h", "Em 2 dias"]);
    expect(NO_REPLY_TASK_TITLE).toBe("Retornar: cliente não respondeu");
    expect(NO_REPLY_TASK_TITLE).not.toContain("—");
  });

  it("hoje 18h é 18h de São Paulo (21h UTC)", () => {
    // Quarta, 25/11/2026 10:00 em São Paulo.
    const due = noReplyReminderDue("today_18", new Date("2026-11-25T13:00:00Z"));
    expect(due?.toISOString()).toBe("2026-11-25T21:00:00.000Z");
  });

  it("hoje 18h some depois das 18h", () => {
    const now = new Date("2026-11-25T21:30:00Z"); // 18:30 em São Paulo
    expect(noReplyReminderDue("today_18", now)).toBeNull();
    expect(noReplyReminderOptions(now).map((item) => item.id)).toEqual(["tomorrow_9", "in_2_days"]);
  });

  it("amanhã 9h usa o dia de São Paulo perto da meia-noite", () => {
    // Quarta 25/11 às 22:30 em São Paulo já é quinta em UTC.
    const due = noReplyReminderDue("tomorrow_9", new Date("2026-11-26T01:30:00Z"));
    expect(due?.toISOString()).toBe("2026-11-26T12:00:00.000Z");
  });

  it("em 2 dias é às 9h", () => {
    const due = noReplyReminderDue("in_2_days", new Date("2026-11-25T13:00:00Z"));
    expect(due?.toISOString()).toBe("2026-11-27T12:00:00.000Z");
  });

  it("domingo vira segunda", () => {
    // Sábado, 28/11/2026 10:00 em São Paulo: amanhã é domingo.
    expect(noReplyReminderDue("tomorrow_9", new Date("2026-11-28T13:00:00Z"))?.toISOString()).toBe("2026-11-30T12:00:00.000Z");
    // Sexta, 27/11: em 2 dias é domingo.
    expect(noReplyReminderDue("in_2_days", new Date("2026-11-27T13:00:00Z"))?.toISOString()).toBe("2026-11-30T12:00:00.000Z");
    // Domingo, 29/11: hoje 18h vai para segunda 18h.
    expect(noReplyReminderDue("today_18", new Date("2026-11-29T13:00:00Z"))?.toISOString()).toBe("2026-11-30T21:00:00.000Z");
  });

  it("mostra o prazo com dia da semana e hora local", () => {
    expect(formatNoReplyReminderDue(new Date("2026-11-26T12:00:00Z"))).toBe("qui, 26/11 às 9h");
    expect(formatNoReplyReminderDue(new Date("2026-11-30T21:00:00Z"))).toBe("seg, 30/11 às 18h");
  });

  it("só aceita as opções conhecidas", () => {
    expect(isNoReplyReminderId("today_18")).toBe(true);
    expect(isNoReplyReminderId("2026-11-30")).toBe(false);
    expect(isNoReplyReminderId(undefined)).toBe(false);
  });
});
