import { describe, expect, it } from "vitest";
import { applyForcedBrokers, generateTypedAssignments } from "./duty-plan-generation";
import { buildRangeOccurrences, type MonthlyPlanOccurrence, type PlanSettings } from "./monthly-duty-plan";

function occurrence(id: string, typeId: string, startsAt = "09:00", endsAt = "10:00", allowedBrokerIds = ["broker"]): MonthlyPlanOccurrence {
  return { id, scheduleId: `schedule-${id}`, scheduleName: id, dutyDate: "2026-10-28", startsAt, endsAt, minimumBrokers: 1, maximumBrokers: null, allowedBrokerIds, typeId, attendanceMode: "online" };
}

function settings(brokers: PlanSettings["brokers"], typeKeys: string[] = ["type-a"]) : PlanSettings {
  return { rangeFrom: "2026-10-28", rangeUntil: "2026-11-04", typeKeys, brokers };
}

describe("typed duty plan generation", () => {
  it("does not let seats for one type fill occurrences of another type", () => {
    const assignments = generateTypedAssignments({
      occurrences: [occurrence("a", "type-a"), occurrence("b", "type-b")],
      settings: settings([{ brokerId: "broker", modality: "any", seats: { "type-a": 1 }, forcedTypeKeys: [] }], ["type-a", "type-b"]),
    });
    expect(assignments).toEqual([{ occurrenceId: "a", brokerId: "broker", origin: "generated" }]);
  });

  it("does not assign an online-only broker to an in-person occurrence", () => {
    const presencial = { ...occurrence("online", "type-a"), attendanceMode: "presencial" as const };
    const assignments = generateTypedAssignments({
      occurrences: [presencial],
      settings: settings([{ brokerId: "broker", modality: "online", seats: { "type-a": 1 }, forcedTypeKeys: [] }]),
    });
    expect(assignments).toEqual([]);
  });

  it("adds a forced broker outside the unit and marks the occurrence", () => {
    const original = occurrence("forced", "type-a", "09:00", "10:00", ["unit-broker"]);
    const [result] = applyForcedBrokers([original], settings([
      { brokerId: "outside-broker", modality: "any", seats: { "type-a": 1 }, forcedTypeKeys: ["type-a"] },
    ]));
    expect(result.allowedBrokerIds).toEqual(["unit-broker", "outside-broker"]);
    expect(result.forcedBrokerIds).toEqual(["outside-broker"]);
  });

  it("honors existing commitments that overlap the occurrence time", () => {
    const assignments = generateTypedAssignments({
      occurrences: [occurrence("overlap", "type-a", "09:00", "10:00"), occurrence("free", "type-a", "10:00", "11:00")],
      settings: settings([{ brokerId: "broker", modality: "any", seats: { "type-a": 1 }, forcedTypeKeys: [] }]),
      commitments: [{ brokerId: "broker", dutyDate: "2026-10-28", startsAt: "08:30", endsAt: "09:30" }],
    });
    expect(assignments).toEqual([{ occurrenceId: "free", brokerId: "broker", origin: "generated" }]);
  });

  it("builds occurrences across the month boundary and respects type units", () => {
    const occurrences = buildRangeOccurrences("2026-10-28", "2026-11-04", [{
      id: "schedule", name: "Plantão", branchId: null, dayOfWeek: 3, startsAt: "09:00", endsAt: "10:00",
      minimumBrokers: 1, maximumBrokers: null, timezone: "America/Sao_Paulo", validFrom: new Date("2026-10-01T00:00:00Z"),
      validUntil: null, typeId: "type-a", typeBranchIds: ["branch-a"],
    }], [{ id: "broker-a", branchId: "branch-a" }, { id: "broker-b", branchId: "branch-b" }]);
    expect(occurrences.map((item) => item.dutyDate)).toEqual(["2026-10-28", "2026-11-04"]);
    expect(occurrences.map((item) => item.allowedBrokerIds)).toEqual([["broker-a"], ["broker-a"]]);
  });

  it("keeps brokers already on the roster, counts their seats and fills only the rest", () => {
    const two = (id: string, startsAt: string, endsAt: string) => ({ ...occurrence(id, "type-a", startsAt, endsAt, ["kept", "new"]), maximumBrokers: 1 });
    const assignments = generateTypedAssignments({
      occurrences: [two("full", "09:00", "10:00"), two("open", "10:00", "11:00"), two("later", "11:00", "12:00")],
      settings: settings([
        { brokerId: "kept", modality: "any", seats: { "type-a": 1 }, forcedTypeKeys: [] },
        { brokerId: "new", modality: "any", seats: { "type-a": 2 }, forcedTypeKeys: [] },
      ]),
      existingByOccurrence: new Map([["full", ["kept"]]]),
    });
    // "full" is already at its maximum; "kept" used its only seat there.
    expect(assignments).toEqual([
      { occurrenceId: "open", brokerId: "new", origin: "generated" },
      { occurrenceId: "later", brokerId: "new", origin: "generated" },
    ]);
  });
});
