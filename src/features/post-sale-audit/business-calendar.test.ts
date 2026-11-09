import { describe, expect, it } from "vitest";

import { isPostSaleBusinessHours, nextPostSaleBusinessOpening, r0WaitingBusinessMinutes } from "./business-calendar";
import { decidePostSaleNudge } from "./conversation-rules";

describe("calendário do pós-venda", () => {
  it("feriado fica fora do horário e a régua só agenda para o próximo dia útil", () => {
    const holidayMorning = new Date("2026-11-20T13:00:00Z");
    expect(isPostSaleBusinessHours(holidayMorning)).toBe(false);
    expect(nextPostSaleBusinessOpening(holidayMorning).toISOString()).toBe("2026-11-23T11:00:00.000Z");
  });

  it("minutos de espera da R0 não contam o feriado", () => {
    // Cliente escreveu quinta 17h50; segunda 08h05 são 15 minutos úteis (10 na quinta e 5 na segunda).
    const minutes = r0WaitingBusinessMinutes({ clockStartedAt: "2026-11-19T20:50:00.000Z", waitingBusinessMinutes: 999 }, new Date("2026-11-23T11:05:00Z"));
    expect(minutes).toBe(15);
    expect(r0WaitingBusinessMinutes({ clockStartedAt: "inválido", waitingBusinessMinutes: 7 }, new Date())).toBe(7);
  });

  it("o lembrete de 4 h úteis espera o feriado passar", () => {
    const sentAt = new Date("2026-11-19T19:00:00Z"); // quinta 16h
    const base = { sentAt, lastReplyAt: null, reminderSentAt: null, channelType: "waha", isR0: false };
    expect(decidePostSaleNudge({ ...base, now: new Date("2026-11-20T20:00:00Z") })).toEqual({ action: "none" });
    expect(decidePostSaleNudge({ ...base, now: new Date("2026-11-23T13:00:00Z") })).toEqual({ action: "remind_opening" });
  });
});
