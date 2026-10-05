import { describe, expect, it } from "vitest";
import { brokerOccurrenceAssignmentBounds, getDutyOccurrenceLeadWindow, getDutyWindowOnDate, isDutyBrokerEligible } from "./duty-presence-domain";

describe("elegibilidade por ocorrência do plantão", () => {
  it("bloqueia a distribuição para quem faltou mesmo sem exigência de confirmação", () => {
    expect(isDutyBrokerEligible({ attendanceMode: "online", presenceRequired: false, status: "absent", confirmedBy: null })).toBe(false);
    expect(isDutyBrokerEligible({ attendanceMode: "online", presenceRequired: false, status: null, confirmedBy: null })).toBe(true);
  });

  it("inicia presencial pausado até a confirmação manual do gestor", () => {
    expect(isDutyBrokerEligible({ attendanceMode: "presencial", presenceRequired: false, status: null, confirmedBy: null })).toBe(false);
    expect(isDutyBrokerEligible({ attendanceMode: "presencial", presenceRequired: true, status: "confirmed", confirmedBy: null })).toBe(false);
    expect(isDutyBrokerEligible({ attendanceMode: "presencial", presenceRequired: false, status: "confirmed", confirmedBy: "manager-1" })).toBe(true);
  });

  it("usa a janela do plantão de segunda desde sexta e limita os leads ao turno", () => {
    const schedule = { dayOfWeek: 1, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
    const now = new Date("2026-10-05T15:00:00Z");
    const leadWindow = getDutyOccurrenceLeadWindow(schedule, [schedule], now);
    const shift = getDutyWindowOnDate(schedule, "2026-10-05");
    const bounds = brokerOccurrenceAssignmentBounds(leadWindow, shift);
    expect(leadWindow.since.toISOString()).toBe("2026-10-02T22:00:00.000Z");
    expect(bounds.since.toISOString()).toBe("2026-10-05T12:00:00.000Z");
    expect(bounds.until?.toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });
});
