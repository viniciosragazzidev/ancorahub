import { describe, expect, it } from "vitest";

import type { BrokerDutyCalendarOccurrence, BrokerDutyCalendarResult } from "./duty-calendar";
import { buildDutyHubCurrent, dutyDateLabel } from "./duty-hub";
import type { BrokerActiveDuty, BrokerWorkspaceData, DutyPresenceAsk } from "./queries";

const now = new Date("2026-09-30T15:00:00-03:00");

function active(overrides: Partial<BrokerActiveDuty> = {}): BrokerActiveDuty {
  return {
    scheduleId: "s-pme",
    scheduleName: "Plantão PME",
    queueName: "PME",
    branchName: "Matriz",
    dutyDate: "2026-09-30",
    startsAt: new Date("2026-09-30T13:00:00-03:00"),
    endsAt: new Date("2026-09-30T17:00:00-03:00"),
    paused: false,
    presenceStatus: "confirmed",
    attendanceMode: "online",
    ...overrides,
  };
}

function ask(overrides: Partial<DutyPresenceAsk> = {}): DutyPresenceAsk {
  return {
    assignmentId: "a-1",
    scheduleId: "s-pres",
    scheduleName: "Presencial Tarde",
    branchName: "Nova Iguaçu",
    mode: "presencial",
    startsAt: new Date("2026-09-30T15:20:00-03:00"),
    endsAt: new Date("2026-09-30T19:00:00-03:00"),
    status: "pending",
    photoId: null,
    ...overrides,
  };
}

function duty(overrides: Partial<NonNullable<BrokerWorkspaceData["duty"]>> = {}): BrokerWorkspaceData["duty"] {
  return { active: null, activeAll: [], next: null, readyToReceive: false, presence: null, presences: [], ...overrides };
}

function occurrence(overrides: Partial<BrokerDutyCalendarOccurrence> = {}): BrokerDutyCalendarOccurrence {
  return {
    id: "weekly:x:2026-10-02",
    assignmentId: "x",
    scheduleId: "s-pme",
    scheduleName: "Plantão PME",
    branchName: "Matriz",
    dutyDate: "2026-10-02",
    startsAt: "09:00",
    endsAt: "13:00",
    source: "weekly",
    paused: false,
    inProgress: false,
    endsNextDay: false,
    ...overrides,
  };
}

function calendar(occurrences: BrokerDutyCalendarOccurrence[]): BrokerDutyCalendarResult {
  return { todayKey: "2026-09-30", firstMonthKey: "2026-09-01", monthCount: 3, endExclusiveKey: "2026-12-01", occurrences };
}

const loaded = { now, workspaceFailed: false, calendarFailed: false };

describe("buildDutyHubCurrent", () => {
  it("shows the plantão in progress with time, place, modality and the operation link", () => {
    const inProgress = occurrence({ id: "weekly:x:2026-09-30", dutyDate: "2026-09-30", startsAt: "13:00", endsAt: "17:00", inProgress: true });
    const result = buildDutyHubCurrent({ ...loaded, duty: duty({ active: active(), activeAll: [active()] }), calendar: calendar([inProgress, occurrence()]) });
    expect(result.state).toBe("active");
    expect(result.shifts).toEqual([expect.objectContaining({
      scheduleName: "Plantão PME",
      dateLabel: "Hoje",
      timeLabel: "13:00 às 17:00",
      place: "Matriz",
      modality: "Online",
      situation: { label: "Recebendo leads", tone: "success" },
      href: "/plantoes/agora",
    })]);
    expect(result.coveredOccurrenceIds).toEqual(["weekly:x:2026-09-30"]);
  });

  it("lets the broker choose when more than one plantão runs now, each with its own link", () => {
    const second = active({ scheduleId: "s-pres", scheduleName: "Presencial Tarde", attendanceMode: "presencial", paused: true });
    const result = buildDutyHubCurrent({ ...loaded, duty: duty({ active: active(), activeAll: [active(), second] }), calendar: null });
    expect(result.state).toBe("active");
    expect(result.shifts.map((shift) => [shift.scheduleName, shift.href, shift.situation.label, shift.modality])).toEqual([
      ["Plantão PME", "/plantoes/agora?plantao=s-pme", "Recebendo leads", "Online"],
      ["Presencial Tarde", "/plantoes/agora?plantao=s-pres", "Pausado", "Presencial"],
    ]);
  });

  it("keeps the presence confirmation link (assignment) for a running plantão waiting for the broker", () => {
    const running = active({ scheduleId: "s-pres", scheduleName: "Presencial Tarde", attendanceMode: "presencial" });
    const result = buildDutyHubCurrent({ ...loaded, duty: duty({ active: running, activeAll: [running], presences: [ask()] }), calendar: null });
    expect(result.shifts[0]).toMatchObject({ situation: { label: "Confirme sua presença", tone: "warning" }, href: "/plantoes/agora?assignment=a-1" });
  });

  it("shows the plantão about to start with its confirmation before the start", () => {
    const result = buildDutyHubCurrent({ ...loaded, duty: duty({ presences: [ask()] }), calendar: calendar([occurrence({ id: "pub", scheduleId: "s-pres", dutyDate: "2026-09-30" })]) });
    expect(result).toMatchObject({ state: "next", coveredOccurrenceIds: ["pub"] });
    expect(result.shifts[0]).toMatchObject({ scheduleName: "Presencial Tarde", timeLabel: "15:20 às 19:00", modality: "Presencial", href: "/plantoes/agora?assignment=a-1" });
  });

  it("shows the next plantão from the calendar when nothing runs now, without an operation link", () => {
    const result = buildDutyHubCurrent({ ...loaded, duty: duty(), calendar: calendar([occurrence(), occurrence({ id: "later", dutyDate: "2026-10-09" })]) });
    expect(result).toMatchObject({ state: "next", coveredOccurrenceIds: ["weekly:x:2026-10-02"] });
    expect(result.shifts[0]).toMatchObject({ dateLabel: "Sexta-feira, 2 de outubro", timeLabel: "09:00 às 13:00", place: "Matriz", situation: { label: "Próximo plantão" }, href: null });
  });

  it("falls back to the workspace next plantão when the calendar is off", () => {
    const next = { scheduleName: "Plantão PME", queueName: "PME", dutyDate: "2026-10-01", startsAt: new Date("2026-10-01T09:00:00-03:00"), endsAt: new Date("2026-10-01T13:00:00-03:00"), paused: false };
    const result = buildDutyHubCurrent({ ...loaded, duty: duty({ next }), calendar: null });
    expect(result.shifts[0]).toMatchObject({ dateLabel: "Amanhã", timeLabel: "09:00 às 13:00" });
  });

  it("says there is no schedule only when everything loaded", () => {
    expect(buildDutyHubCurrent({ ...loaded, duty: duty(), calendar: calendar([]) }).state).toBe("none");
    expect(buildDutyHubCurrent({ ...loaded, duty: null, calendar: null }).state).toBe("none");
  });

  it("reports a loading failure instead of an empty schedule", () => {
    expect(buildDutyHubCurrent({ ...loaded, workspaceFailed: true, duty: undefined, calendar: calendar([occurrence()]) }).state).toBe("error");
    expect(buildDutyHubCurrent({ ...loaded, calendarFailed: true, duty: duty(), calendar: null }).state).toBe("error");
  });
});

describe("dutyDateLabel", () => {
  it("names today and tomorrow and spells out other dates", () => {
    expect(dutyDateLabel("2026-09-30", "2026-09-30")).toBe("Hoje");
    expect(dutyDateLabel("2026-10-01", "2026-09-30")).toBe("Amanhã");
    expect(dutyDateLabel("2026-10-31", "2026-10-30")).toBe("Amanhã");
    expect(dutyDateLabel("2026-10-05", "2026-09-30")).toBe("Segunda-feira, 5 de outubro");
  });
});
