import { describe, expect, it } from "vitest";

import { pickBusiestRunning, pickNextDuty, upcomingShift, type WelcomeSchedule } from "./welcome-rules";

const base: Omit<WelcomeSchedule, "id" | "name" | "dayOfWeek" | "validFrom" | "validUntil"> = {
  startsAt: "09:00",
  endsAt: "18:00",
  timezone: "America/Sao_Paulo",
};

// Saturday 26/09/2026, 10:00 in São Paulo
const now = new Date("2026-09-26T13:00:00Z");

describe("upcomingShift", () => {
  it("finds the next weekly shift inside the validity", () => {
    const pf: WelcomeSchedule = { ...base, id: "pf", name: "Plantão PF", dayOfWeek: 1, validFrom: new Date("2026-09-28T03:00:00Z"), validUntil: new Date("2026-10-29T03:00:00Z") };
    const shift = upcomingShift(pf, now);
    expect(shift?.dutyDate).toBe("2026-09-28");
    expect(shift?.running).toBe(false);
    expect(shift?.start.toISOString()).toBe("2026-09-28T12:00:00.000Z");
  });

  it("marks a shift happening now as running", () => {
    const today: WelcomeSchedule = { ...base, id: "sat", name: "Sábado", dayOfWeek: 6, validFrom: new Date("2026-09-26T03:00:00Z"), validUntil: new Date("2026-09-27T03:00:00Z") };
    expect(upcomingShift(today, now)).toMatchObject({ dutyDate: "2026-09-26", running: true });
  });

  it("ignores a one-day plantão that already ended", () => {
    const past: WelcomeSchedule = { ...base, id: "pme", name: "PME 23/09", dayOfWeek: 3, validFrom: new Date("2026-09-23T03:00:00Z"), validUntil: new Date("2026-09-24T03:00:00Z") };
    expect(upcomingShift(past, now)).toBeNull();
  });

  it("keeps an overnight shift that started yesterday", () => {
    const night: WelcomeSchedule = { ...base, id: "n", name: "Noturno", dayOfWeek: 5, startsAt: "20:00", endsAt: "11:00", validFrom: new Date("2026-09-01T03:00:00Z"), validUntil: null };
    expect(upcomingShift(night, now)).toMatchObject({ dutyDate: "2026-09-25", running: true });
  });
});

describe("pickNextDuty", () => {
  it("prefers the running plantão over a later one", () => {
    const monday: WelcomeSchedule = { ...base, id: "mon", name: "Segunda", dayOfWeek: 1, validFrom: new Date("2026-09-01T03:00:00Z"), validUntil: null };
    const saturday: WelcomeSchedule = { ...base, id: "sat", name: "Sábado", dayOfWeek: 6, validFrom: new Date("2026-09-01T03:00:00Z"), validUntil: null };
    expect(pickNextDuty([monday, saturday], now)?.schedule.id).toBe("sat");
    expect(pickNextDuty([], now)).toBeNull();
  });
});

describe("busiest running plantão", () => {
  const shift = (hour: number) => ({ dutyDate: "2026-09-28", start: new Date(`2026-09-28T${String(hour).padStart(2, "0")}:00:00Z`), end: new Date("2026-09-28T21:00:00Z"), running: true });
  const pf = { schedule: { id: "pf" }, shift: shift(12) };
  const pme = { schedule: { id: "pme" }, shift: shift(12) };
  it("shows the plantão with confirmed brokers, not the empty one that started at the same time", () => {
    const activity = new Map([["pf", { confirmedBrokers: 0, leadsToday: 0, brokers: 0 }], ["pme", { confirmedBrokers: 3, leadsToday: 16, brokers: 3 }]]);
    expect(pickBusiestRunning([pf, pme], activity)?.schedule.id).toBe("pme");
  });
  it("breaks ties by leads today, then roster size, then start time", () => {
    expect(pickBusiestRunning([pf, pme], new Map([["pf", { confirmedBrokers: 2, leadsToday: 9, brokers: 2 }], ["pme", { confirmedBrokers: 2, leadsToday: 4, brokers: 5 }]]))?.schedule.id).toBe("pf");
    expect(pickBusiestRunning([pf, pme], new Map([["pf", { confirmedBrokers: 1, leadsToday: 1, brokers: 1 }], ["pme", { confirmedBrokers: 1, leadsToday: 1, brokers: 4 }]]))?.schedule.id).toBe("pme");
    const early = { schedule: { id: "early" }, shift: shift(11) };
    expect(pickBusiestRunning([pf, early], new Map())?.schedule.id).toBe("early");
  });
});
