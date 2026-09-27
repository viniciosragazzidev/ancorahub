import { describe, expect, it } from "vitest";
import {
  buildMonthOccurrences,
  findDraftProblems,
  firstValidShift,
  isSingleOccurrencePlantao,
  monthCoverage,
  monthShiftProgress,
  summarizeDutyDays,
  occurrenceValidity,
  summarizeDraft,
  zonedMidnight,
  type MonthlyPlanSchedule,
} from "./monthly-duty-plan";

const saturdayMorning: MonthlyPlanSchedule = {
  id: "sat-am", name: "Sábado manhã", branchId: null, dayOfWeek: 6, startsAt: "09:00", endsAt: "13:00",
  minimumBrokers: 2, maximumBrokers: 3, timezone: "America/Sao_Paulo",
  validFrom: new Date("2026-01-01T03:00:00Z"), validUntil: null,
};
const brokers = [
  { id: "ana", branchId: "centro" },
  { id: "bia", branchId: "norte" },
  { id: "caio", branchId: "norte" },
];

describe("summarizeDutyDays", () => {
  it("counts each date once across plantões and keeps completed dates in the monthly total", () => {
    expect(summarizeDutyDays([
      { dates: [{ date: "2026-10-03", done: true }, { date: "2026-10-10", done: false }] },
      { dates: [{ date: "2026-10-03", done: true }, { date: "2026-10-10", done: true }, { date: "2026-10-17", done: false }] },
    ])).toEqual({ total: 3, upcoming: 2, finished: 1 });
    expect(summarizeDutyDays([])).toEqual({ total: 0, upcoming: 0, finished: 0 });
  });
});

describe("buildMonthOccurrences", () => {
  it("creates a global plantão once per date, open to every unit", () => {
    const occurrences = buildMonthOccurrences("2026-10", [saturdayMorning], brokers);
    expect(occurrences.map((occurrence) => occurrence.dutyDate)).toEqual(["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]);
    expect(occurrences[0]).toMatchObject({ id: "sat-am:2026-10-03", minimumBrokers: 2, maximumBrokers: 3, allowedBrokerIds: ["ana", "bia", "caio"] });
  });

  it("limits a unit plantão to that unit's brokers", () => {
    const [first] = buildMonthOccurrences("2026-10", [{ ...saturdayMorning, branchId: "norte" }], brokers);
    expect(first.allowedBrokerIds).toEqual(["bia", "caio"]);
  });

  it("respects the plantão validity dates", () => {
    const occurrences = buildMonthOccurrences("2026-10", [{
      ...saturdayMorning,
      validFrom: new Date("2026-10-10T03:00:00Z"),
      validUntil: new Date("2026-10-24T03:00:00Z"),
    }], brokers);
    expect(occurrences.map((occurrence) => occurrence.dutyDate)).toEqual(["2026-10-10", "2026-10-17"]);
  });

  it("leaves out shifts that already ended, keeping the one running now", () => {
    // Saturday 10/10/2026, 11:00 in São Paulo: the 09:00–13:00 shift is running.
    const running = buildMonthOccurrences("2026-10", [saturdayMorning], brokers, { from: new Date("2026-10-10T14:00:00Z") });
    expect(running.map((occurrence) => occurrence.dutyDate)).toEqual(["2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"]);
    // 13:00 sharp: that shift is over.
    const over = buildMonthOccurrences("2026-10", [saturdayMorning], brokers, { from: new Date("2026-10-10T16:00:00Z") });
    expect(over[0].dutyDate).toBe("2026-10-17");
  });

  it("drops every date of a past one-day plantão", () => {
    const pme23 = { ...saturdayMorning, id: "pme23", dayOfWeek: 3, validFrom: new Date("2026-09-23T03:00:00Z"), validUntil: new Date("2026-09-24T03:00:00Z") };
    expect(buildMonthOccurrences("2026-09", [pme23], brokers)).toHaveLength(1);
    expect(buildMonthOccurrences("2026-09", [pme23], brokers, { from: new Date("2026-09-26T13:00:00Z") })).toEqual([]);
  });
});

describe("occurrence validity", () => {
  it("spans exactly one local day in the plantão time zone", () => {
    expect(occurrenceValidity("2026-10-03", "America/Sao_Paulo")).toEqual({
      validFrom: new Date("2026-10-03T03:00:00.000Z"),
      validUntil: new Date("2026-10-04T03:00:00.000Z"),
    });
  });

  it("does not assume a fixed offset", () => {
    expect(zonedMidnight("2026-07-01", "America/Manaus")).toEqual(new Date("2026-07-01T04:00:00.000Z"));
    expect(zonedMidnight("2026-07-01", "Europe/Lisbon")).toEqual(new Date("2026-06-30T23:00:00.000Z"));
  });
});

describe("findDraftProblems", () => {
  const occurrences = buildMonthOccurrences("2026-10", [
    { ...saturdayMorning, maximumBrokers: 1 },
    { ...saturdayMorning, id: "sat-late", startsAt: "12:00", endsAt: "15:00", branchId: "norte" },
  ], brokers);

  it("accepts a valid draft", () => {
    expect(findDraftProblems(occurrences, [{ occurrenceId: "sat-am:2026-10-03", brokerId: "ana" }])).toEqual([]);
  });

  it("flags capacity, eligibility, overlap, duplicates and stale occurrences", () => {
    const problems = findDraftProblems(occurrences, [
      { occurrenceId: "sat-am:2026-10-03", brokerId: "ana" },
      { occurrenceId: "sat-am:2026-10-03", brokerId: "bia" },
      { occurrenceId: "sat-late:2026-10-03", brokerId: "ana" },
      { occurrenceId: "sat-late:2026-10-03", brokerId: "bia" },
      { occurrenceId: "sat-late:2026-10-03", brokerId: "bia" },
      { occurrenceId: "gone:2026-10-03", brokerId: "ana" },
    ]).map((problem) => problem.kind).sort();
    expect(problems).toEqual(["duplicate", "not_eligible", "over_capacity", "overlap", "overlap", "unknown_occurrence"]);
  });
});

describe("summarizeDraft", () => {
  it("counts occurrences below minimum and unmet quota", () => {
    const occurrences = buildMonthOccurrences("2026-10", [saturdayMorning], brokers);
    const summary = summarizeDraft(occurrences, [{ occurrenceId: "sat-am:2026-10-03", brokerId: "ana" }], new Map([["ana", 2], ["bia", 1]]));
    expect(summary.belowMinimum).toBe(5);
    expect(summary.missingQuota).toBe(2);
  });
});

describe("monthCoverage", () => {
  it("explains why a plantão is out of the month (real case: PME ending in November)", () => {
    const pme = { ...saturdayMorning, dayOfWeek: 2, validFrom: new Date("2026-09-21T03:00:00Z"), validUntil: new Date("2026-11-22T03:00:00Z") };
    expect(monthCoverage(pme, "2026-11")).toEqual({ covered: true });
    expect(monthCoverage(pme, "2026-12")).toEqual({ covered: false, reason: "ends_before" });
    expect(monthCoverage({ ...pme, validFrom: new Date("2027-02-01T03:00:00Z"), validUntil: null }, "2026-12")).toEqual({ covered: false, reason: "starts_after" });
    expect(monthCoverage({ ...saturdayMorning, validUntil: null }, "2026-12")).toEqual({ covered: true });
    // Real case "PME 28/09": starts and ends on 27/09, never happens.
    expect(monthCoverage({ ...pme, validFrom: new Date("2026-09-27T03:00:00Z"), validUntil: new Date("2026-09-27T03:00:00Z") }, "2026-09")).toEqual({ covered: false, reason: "empty_range" });
    // Real case "PME 25/09" after a bad edit: a Friday rule valid only on Sunday 20/09.
    expect(monthCoverage({ ...pme, dayOfWeek: 5, validFrom: new Date("2026-09-20T03:00:00Z"), validUntil: new Date("2026-09-21T03:00:00Z") }, "2026-09")).toEqual({ covered: false, reason: "empty_range" });
  });

  it("counts the last day of an end date entered as a calendar day", () => {
    // "até 31/12" is stored as 01/01 00:00 in São Paulo: 31/12 still has its shift.
    const occurrences = buildMonthOccurrences("2026-12", [{ ...saturdayMorning, dayOfWeek: 4, validUntil: new Date("2027-01-01T03:00:00Z") }], brokers);
    expect(occurrences.at(-1)?.dutyDate).toBe("2026-12-31");
  });
});

describe("monthShiftProgress", () => {
  // Saturday 26/09/2026, 10:00 in São Paulo.
  const now = new Date("2026-09-26T13:00:00Z");
  const weekday = (dayOfWeek: number) => ({ ...saturdayMorning, dayOfWeek, startsAt: "09:00", endsAt: "18:00", validFrom: new Date("2026-09-01T03:00:00Z"), validUntil: null });

  it("marks a plantão finished once its last shift of the month has ended", () => {
    expect(monthShiftProgress(weekday(5), "2026-09", now)).toMatchObject({ finished: true, lastDate: "2026-09-25", nextDate: null });
    expect(monthShiftProgress(weekday(1), "2026-09", now)).toMatchObject({ finished: false, lastDate: "2026-09-21", nextDate: "2026-09-28" });
  });

  it("lists the month's dates of a weekly rule (real case: PME 23/09 still runs on 30/09)", () => {
    const pme = { ...weekday(3), validFrom: new Date("2026-09-20T03:00:00Z"), validUntil: new Date("2026-11-21T03:00:00Z") };
    expect(monthShiftProgress(pme, "2026-09", now)).toEqual({
      finished: false,
      lastDate: "2026-09-23",
      nextDate: "2026-09-30",
      dates: [{ date: "2026-09-23", done: true }, { date: "2026-09-30", done: false }],
    });
  });

  it("does not finish a shift that is still running", () => {
    expect(monthShiftProgress(weekday(6), "2026-09", now)).toMatchObject({ finished: false, nextDate: "2026-09-26" });
  });

  it("keeps future months open", () => {
    expect(monthShiftProgress(weekday(5), "2026-10", now).finished).toBe(false);
  });
});

describe("firstValidShift", () => {
  it("finds the plantão's own date (real case: PME 28/09)", () => {
    const pme28 = { ...saturdayMorning, dayOfWeek: 1, startsAt: "09:00", endsAt: "18:00", validFrom: new Date("2026-09-28T03:00:00Z"), validUntil: new Date("2026-09-29T03:00:00Z") };
    expect(firstValidShift(pme28)).toEqual({ dutyDate: "2026-09-28", start: new Date("2026-09-28T12:00:00Z"), end: new Date("2026-09-28T21:00:00Z") });
  });
});

describe("isSingleOccurrencePlantao", () => {
  it("tells one-day plantões from weekly rules", () => {
    const pme23 = { ...saturdayMorning, dayOfWeek: 3, startsAt: "09:00", validFrom: new Date("2026-09-20T03:00:00Z"), validUntil: new Date("2026-09-24T03:00:00Z") };
    expect(isSingleOccurrencePlantao(pme23)).toBe(true);
    expect(isSingleOccurrencePlantao({ ...pme23, validUntil: null })).toBe(false);
    expect(isSingleOccurrencePlantao({ ...pme23, validUntil: new Date("2026-11-21T03:00:00Z") })).toBe(false);
  });
});
