import { describe, expect, it } from "vitest";

import {
  dutyShiftReminderIdempotencyKey,
  dutyShiftReminderFailureCode,
  dutyShiftReminderWahaFailure,
  formatDutyShiftReminderVariables,
  getDutyReminderDateKey,
  isDutyShiftReminderDue,
  selectDueDutyShiftReminders,
  type DutyReminderAssignment,
  type DutyReminderSchedule,
} from "./duty-shift-reminder-domain";

const now = new Date("2026-10-27T13:00:00.000Z"); // terça, 10:00 em São Paulo
const schedule: DutyReminderSchedule = {
  id: "schedule-a", tenantId: "tenant-a", name: "Presencial tarde", dayOfWeek: 3,
  startsAt: "10:00", endsAt: "16:00", timezone: "America/Sao_Paulo", attendanceMode: "presencial",
  validFrom: new Date("2026-01-01T00:00:00.000Z"), validUntil: null, status: "active",
};
const assignment = (overrides: Partial<DutyReminderAssignment> = {}): DutyReminderAssignment => ({
  id: "assignment-a", tenantId: "tenant-a", scheduleId: schedule.id, brokerId: "broker-a", brokerName: "Ana",
  phone: "5521999999999", dayOfWeek: 3, startsAt: "10:00", endsAt: "16:00", validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: null, dutyDate: null, monthlyPlanId: null, pausedAt: null, attendanceMode: null, branchName: "Centro", status: "active", ...overrides,
});

describe("lembrete de plantão 24 h", () => {
  it("começa exatamente 24 h antes e encerra em 2 h antes", () => {
    expect(isDutyShiftReminderDue(new Date(now.getTime() + 24 * 60 * 60_000), now)).toBe(true);
    expect(isDutyShiftReminderDue(new Date(now.getTime() + 2 * 60 * 60_000), now)).toBe(false);
    expect(isDutyShiftReminderDue(new Date(now.getTime() + 2 * 60 * 60_000 + 1), now)).toBe(true);
  });

  it("resolve o dia seguinte no fuso do plantão e seleciona a ocorrência efetiva publicada", () => {
    const dutyDate = getDutyReminderDateKey(now, schedule.timezone);
    expect(dutyDate).toBe("2026-10-28");
    const dated = assignment({ id: "published-row", dutyDate, monthlyPlanId: "plan-a", startsAt: "10:00", endsAt: "16:00" });
    const due = selectDueDutyShiftReminders({
      schedules: [schedule], assignments: [assignment(), dated], now,
      publishedScheduleIdsByTenantDate: new Map([[`tenant-a:${dutyDate}`, new Set([schedule.id])]]),
    });
    expect(due).toHaveLength(1);
    expect(due[0]?.assignment.id).toBe("published-row");
    expect(formatDutyShiftReminderVariables(due[0]!)).toEqual(["Ana", "quarta-feira", "28/10", "Presencial tarde", "10:00", "16:00", "Presencial"]);
  });

  it("não inclui pausados nem convidados sem conta", () => {
    const due = selectDueDutyShiftReminders({
      schedules: [schedule],
      assignments: [assignment({ id: "paused", pausedAt: now }), assignment({ id: "guest", hasAccount: false })],
      now, publishedScheduleIdsByTenantDate: new Map([["tenant-a:2026-10-28", null]]),
    });
    expect(due).toEqual([]);
  });

  it("usa chave idempotente por escalação, corretor e início; corretor novo após troca pode receber", () => {
    const due = selectDueDutyShiftReminders({
      schedules: [schedule], assignments: [assignment()], now,
      publishedScheduleIdsByTenantDate: new Map([["tenant-a:2026-10-28", null]]),
    })[0]!;
    const oldKey = dutyShiftReminderIdempotencyKey(due);
    const swapped = { ...due, assignment: { ...due.assignment, brokerId: "broker-b" } };
    expect(oldKey).toBe("duty-reminder-24h:assignment-a:broker-a:2026-10-28T13:00:00.000Z");
    expect(dutyShiftReminderIdempotencyKey(swapped)).not.toBe(oldKey);
  });

  it("registra sem telefone e indisponibilidade WAHA sem abrir rota para Meta", () => {
    expect(dutyShiftReminderFailureCode(null, "waha-a")).toBe("BROKER_PHONE_UNAVAILABLE");
    expect(dutyShiftReminderFailureCode("5521999999999", null)).toBe("COMPANY_NUMBER_UNAVAILABLE");
    expect(dutyShiftReminderFailureCode("5521999999999", "waha-a")).toBeNull();
    expect(dutyShiftReminderWahaFailure(true)).toMatchObject({ code: "COMPANY_NUMBER_UNAVAILABLE", retryableOnNextSweep: true });
    expect(dutyShiftReminderWahaFailure(false)).toMatchObject({ code: "COMPANY_NUMBER_SEND_FAILED", retryableOnNextSweep: false });
  });
});
