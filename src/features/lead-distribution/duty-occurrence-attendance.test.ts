import { describe, expect, it } from "vitest";
import { brokerOccurrenceAssignmentBounds, findDutyOccurrenceConfirmation, getDutyOccurrenceLeadWindow, getDutyWindowOnDate, isDutyBrokerEligible } from "./duty-presence-domain";
import { buildDuplicateDutyScheduleValues, getAttendanceModeUpdate } from "./duty-schedule-input";

describe("elegibilidade por ocorrência do plantão", () => {
  it("mantém o modo presencial ao editar sem o campo no formulário", () => {
    expect(getAttendanceModeUpdate(new FormData(), "online")).toEqual({});
    const form = new FormData();
    form.set("attendanceMode", "presencial");
    expect(getAttendanceModeUpdate(form, "presencial")).toEqual({ attendanceMode: "presencial" });
  });

  it("copia o modo presencial ao duplicar um plantão", () => {
    const source = { id: "source", name: "Plantão", attendanceMode: "presencial", status: "active" };
    expect(buildDuplicateDutyScheduleValues(source, "copy", "director", new Date(0))).toMatchObject({
      id: "copy", name: "Plantão (cópia)", attendanceMode: "presencial", status: "inactive",
    });
  });

  it("bloqueia a distribuição para quem faltou mesmo sem exigência de confirmação", () => {
    expect(isDutyBrokerEligible({ attendanceMode: "online", presenceRequired: false, status: "absent", confirmedBy: null })).toBe(false);
    expect(isDutyBrokerEligible({ attendanceMode: "online", presenceRequired: false, status: null, confirmedBy: null })).toBe(true);
  });

  it("inicia presencial pausado até a confirmação manual do gestor", () => {
    expect(isDutyBrokerEligible({ attendanceMode: "presencial", presenceRequired: false, status: null, confirmedBy: null })).toBe(false);
    expect(isDutyBrokerEligible({ attendanceMode: "presencial", presenceRequired: true, status: "confirmed", confirmedBy: null })).toBe(false);
    expect(isDutyBrokerEligible({ attendanceMode: "presencial", presenceRequired: false, status: "confirmed", confirmedBy: "manager-1" })).toBe(true);
  });

  it("ignora falta ou pendência de outra data ao escolher a confirmação da ocorrência ativa", () => {
    const schedule = { dayOfWeek: 1, startsAt: "09:00", endsAt: "18:00", timezone: "America/Sao_Paulo" };
    const now = new Date("2026-10-05T15:00:00Z");
    const activeWindow = getDutyWindowOnDate(schedule, "2026-10-05")!;
    const futureWindow = getDutyWindowOnDate(schedule, "2026-10-12")!;
    const assignment = { id: "assignment-1", scheduleId: "schedule-1", brokerId: "broker-1" };
    const activeConfirmation = { assignmentId: assignment.id, scheduleId: assignment.scheduleId, brokerId: assignment.brokerId, dutyDate: activeWindow.dutyDate, shiftStartsAt: activeWindow.startsAt, shiftEndsAt: activeWindow.endsAt, status: "confirmed", confirmedBy: null };
    const futureAbsence = { ...activeConfirmation, dutyDate: futureWindow.dutyDate, shiftStartsAt: futureWindow.startsAt, shiftEndsAt: futureWindow.endsAt, status: "absent" };
    const futurePending = { ...futureAbsence, status: "pending" };
    for (const otherOccurrence of [futureAbsence, futurePending]) {
      const confirmation = findDutyOccurrenceConfirmation({ confirmations: [otherOccurrence, activeConfirmation], assignment, window: activeWindow, now });
      expect(confirmation).toBe(activeConfirmation);
      expect(isDutyBrokerEligible({ attendanceMode: "online", presenceRequired: true, status: confirmation?.status ?? null, confirmedBy: confirmation?.confirmedBy ?? null })).toBe(true);
    }
    expect(findDutyOccurrenceConfirmation({ confirmations: [futureAbsence], assignment, window: activeWindow, now })).toBeUndefined();
    expect(isDutyBrokerEligible({ attendanceMode: "online", presenceRequired: false, status: null, confirmedBy: null })).toBe(true);
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
