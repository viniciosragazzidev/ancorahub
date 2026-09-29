import { describe, expect, it } from "vitest";
import { generateDutyScheduleDraft } from "./duty-scheduling-engine";

const shifts = [
  { id: "s1", scheduleId: "weekly-1", dutyDate: "2026-10-03", startsAt: "09:00", endsAt: "13:00", minimumBrokers: 1, maximumBrokers: 1 },
  { id: "s2", scheduleId: "weekly-2", dutyDate: "2026-10-10", startsAt: "09:00", endsAt: "13:00", minimumBrokers: 1, maximumBrokers: 1 },
  { id: "s3", scheduleId: "weekly-3", dutyDate: "2026-10-17", startsAt: "09:00", endsAt: "13:00", minimumBrokers: 1, maximumBrokers: 1 },
];

describe("generateDutyScheduleDraft", () => {
  it("is deterministic, respects quotas and does not exceed occurrence capacity", () => {
    const input = [{ id: "broker-a", quota: 2 }, { id: "broker-b", quota: 2 }];
    const first = generateDutyScheduleDraft(input, shifts);
    expect(generateDutyScheduleDraft(input, shifts)).toEqual(first);
    expect(first.assignments).toHaveLength(3);
    expect(first.quotas.reduce((sum, quota) => sum + quota.assigned, 0)).toBe(3);
    expect(first.quotas.reduce((sum, quota) => sum + quota.missing, 0)).toBe(1);
    expect(first.occurrences.every((occurrence) => occurrence.assigned <= (occurrence.maximum ?? Infinity))).toBe(true);
  });

  it("excludes unavailable dates and overlapping existing commitments", () => {
    const [draft] = generateDutyScheduleDraft([
      { id: "broker-a", quota: 3, unavailableDates: ["2026-10-10"], existingCommitments: [{ dutyDate: "2026-10-17", startsAt: "08:00", endsAt: "10:00" }] },
    ], shifts).quotas;
    expect(draft).toEqual({ brokerId: "broker-a", required: 3, assigned: 1, missing: 2 });
  });

  it("requires a declared weekly window to cover the whole occurrence", () => {
    const result = generateDutyScheduleDraft([
      { id: "broker-a", quota: 1, availabilityWindows: [{ dayOfWeek: 6, startsAt: "10:00", endsAt: "14:00" }] },
    ], [shifts[0]]);
    expect(result.quotas[0]).toMatchObject({ assigned: 0, missing: 1 });
  });

  it("keeps a branch-specific occurrence limited to brokers in that branch", () => {
    const [first, second] = generateDutyScheduleDraft([
      { id: "branch-a", quota: 1 },
      { id: "branch-b", quota: 1 },
    ], [
      { ...shifts[0], allowedBrokerIds: ["branch-a"] },
      { ...shifts[1], allowedBrokerIds: ["branch-b"] },
    ]).assignments;
    expect(first).toMatchObject({ brokerId: "branch-a", occurrenceId: "s1" });
    expect(second).toMatchObject({ brokerId: "branch-b", occurrenceId: "s2" });
  });

  it("keeps types outside eligibility and reports occurrences below minimum", () => {
    const result = generateDutyScheduleDraft([], [{ ...shifts[0], minimumBrokers: 2, maximumBrokers: null }]);
    expect(result.occurrences).toEqual([{ occurrenceId: "s1", minimum: 2, assigned: 0, maximum: null, belowMinimum: true }]);
  });

  it("shares scarce slots across brokers instead of filling one quota first", () => {
    const scarce = [shifts[0], shifts[1]];
    const result = generateDutyScheduleDraft([{ id: "big", quota: 4 }, { id: "small", quota: 1 }], scarce);
    expect(result.quotas).toEqual([
      { brokerId: "big", required: 4, assigned: 1, missing: 3 },
      { brokerId: "small", required: 1, assigned: 1, missing: 0 },
    ]);
  });

  it("fills occurrences below their minimum before adding to covered ones", () => {
    const covered = { ...shifts[0], minimumBrokers: 1, maximumBrokers: null, assignedBrokerIds: ["already"] };
    const needsTwo = { ...shifts[1], minimumBrokers: 2, maximumBrokers: null };
    const result = generateDutyScheduleDraft([{ id: "x", quota: 1 }, { id: "y", quota: 1 }], [covered, needsTwo]);
    expect(result.occurrences.find((occurrence) => occurrence.occurrenceId === "s2")).toMatchObject({ assigned: 2, belowMinimum: false });
  });

  it("gives the same draft whatever the input order", () => {
    const month = ["2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24", "2026-10-31"].flatMap((dutyDate) => [
      { id: `${dutyDate}-am`, scheduleId: "am", dutyDate, startsAt: "09:00", endsAt: "13:00", minimumBrokers: 2, maximumBrokers: 3 },
      { id: `${dutyDate}-pm`, scheduleId: "pm", dutyDate, startsAt: "13:00", endsAt: "18:00", minimumBrokers: 2, maximumBrokers: 3 },
    ]);
    const team = Array.from({ length: 8 }, (_, index) => ({ id: `b${index + 1}`, quota: 2 }));
    const key = (draft: ReturnType<typeof generateDutyScheduleDraft>) =>
      draft.assignments.map((assignment) => `${assignment.brokerId}>${assignment.occurrenceId}`).sort();
    const forward = generateDutyScheduleDraft(team, month);
    expect(key(generateDutyScheduleDraft([...team].reverse(), [...month].reverse()))).toEqual(key(forward));
    // 16 slots for 10 occurrences: every occurrence gets someone, none above its maximum.
    expect(forward.occurrences.every((occurrence) => occurrence.assigned >= 1 && occurrence.assigned <= 3)).toBe(true);
  });
});
