import { describe, expect, it } from "vitest";
import { defaultIntelligentDistributionPolicy, resolveDistributionCandidate } from "./domain";
import { inferLegacyLeadDutyScheduleId, selectBrokerDutyScheduleIds, selectLeadsForDutySchedule } from "./shared-duty-roster";

describe("selectBrokerDutyScheduleIds", () => {
  it("unites active rosters and uses the occurrence with confirmed presence", () => {
    const selected = selectBrokerDutyScheduleIds([
      { id: "a1", brokerId: "broker-a", scheduleId: "schedule-a" },
      { id: "b1", brokerId: "broker-a", scheduleId: "schedule-b" },
      { id: "b2", brokerId: "broker-b", scheduleId: "schedule-b" },
    ], new Set(["schedule-a", "schedule-b"]), new Set(["a1", "b1", "b2"]), new Set(["b1", "b2"]));

    expect([...selected]).toEqual([["broker-a", "schedule-b"], ["broker-b", "schedule-b"]]);
  });

  it("selects the lower-load broker from the union of two active schedules", () => {
    const scheduleByBroker = selectBrokerDutyScheduleIds([
      { id: "a1", brokerId: "broker-a", scheduleId: "schedule-a" },
      { id: "b1", brokerId: "broker-b", scheduleId: "schedule-b" },
      { id: "off1", brokerId: "broker-off", scheduleId: "schedule-off" },
    ], new Set(["schedule-a", "schedule-b"]), new Set(["a1", "b1", "off1"]));
    const candidates = [...scheduleByBroker].map(([id, scheduleId]) => ({
      id, scheduleId, createdAt: new Date("2026-01-01"), activeLeads: 0,
      capacity: null, onDuty: true, conversionRate: 0, slaRate: 0,
      manualPriority: 0, idleSince: null, rankingScore: 0,
      receivedInDuty: id === "broker-a" ? 0 : 1,
    }));
    const decision = resolveDistributionCandidate(candidates, defaultIntelligentDistributionPolicy, "capacity", () => 0);

    expect(decision.selected?.id).toBe("broker-a");
    expect(scheduleByBroker.get(decision.selected!.id)).toBe("schedule-a");
    expect(scheduleByBroker.has("broker-off")).toBe(false);
  });

  it("does not include inactive schedules", () => {
    const selected = selectBrokerDutyScheduleIds([
      { id: "inactive", brokerId: "broker-a", scheduleId: "schedule-off" },
    ], new Set(["schedule-on"]), new Set(["inactive"]));

    expect(selected.size).toBe(0);
  });

  it("separates two shared-queue totals and their sum equals the queue total", () => {
    const leads = [
      { dutyScheduleId: "schedule-a" }, { dutyScheduleId: "schedule-a" },
      { dutyScheduleId: "schedule-b" }, { dutyScheduleId: "schedule-b" }, { dutyScheduleId: "schedule-b" },
    ];
    const scheduleA = selectLeadsForDutySchedule(leads, "schedule-a");
    const scheduleB = selectLeadsForDutySchedule(leads, "schedule-b");

    expect(scheduleA).toHaveLength(2);
    expect(scheduleB).toHaveLength(3);
    expect(scheduleA.length + scheduleB.length).toBe(leads.length);
  });

  it("a waiting lead (no broker, no plantão yet) stays visible on both shared-queue plantões instead of vanishing", () => {
    const leads = [
      { dutyScheduleId: "schedule-a", corretorId: "broker-a" },
      { dutyScheduleId: "schedule-b", corretorId: "broker-b" },
      { dutyScheduleId: null, corretorId: null },
    ];
    const scheduleA = selectLeadsForDutySchedule(leads, "schedule-a");
    const scheduleB = selectLeadsForDutySchedule(leads, "schedule-b");

    expect(scheduleA.map((lead) => lead.corretorId)).toEqual(["broker-a", null]);
    expect(scheduleB.map((lead) => lead.corretorId)).toEqual(["broker-b", null]);
  });

  it("legacy attribution (broker set, no dutyScheduleId) only shows in the single-schedule view", () => {
    const leads = [
      { dutyScheduleId: "schedule-a", corretorId: "broker-a" },
      { dutyScheduleId: null, corretorId: "broker-legacy" },
    ];

    expect(selectLeadsForDutySchedule(leads, "schedule-a").map((lead) => lead.corretorId)).toEqual(["broker-a"]);
    expect(selectLeadsForDutySchedule(leads, "schedule-a", true).map((lead) => lead.corretorId)).toEqual(["broker-a", "broker-legacy"]);
  });

  it("keeps legacy assigned leads on the schedule represented by the broker's confirmed occurrence", () => {
    const assignments = [
      { id: "assignment-a", brokerId: "broker-shared", scheduleId: "schedule-a" },
      { id: "assignment-b", brokerId: "broker-shared", scheduleId: "schedule-b" },
    ];
    const selectedSchedule = inferLegacyLeadDutyScheduleId({
      brokerId: "broker-shared",
      leadBranchId: "branch-1",
      assignments,
      activeScheduleIds: new Set(["schedule-a", "schedule-b"]),
      eligibleAssignmentIds: new Set(["assignment-a", "assignment-b"]),
      confirmedPresenceAssignmentIds: new Set(["assignment-b"]),
      branchIdBySchedule: new Map([["schedule-a", "branch-1"], ["schedule-b", "branch-1"]]),
    });
    const leads = [{ id: "legacy-lead", corretorId: "broker-shared", dutyScheduleId: null }];
    const legacyScheduleForLead = () => selectedSchedule;

    expect(selectLeadsForDutySchedule(leads, "schedule-a", false, legacyScheduleForLead)).toHaveLength(0);
    expect(selectLeadsForDutySchedule(leads, "schedule-b", false, legacyScheduleForLead)).toHaveLength(1);
  });

  it("does not attribute a legacy lead to an unrelated branch schedule", () => {
    expect(inferLegacyLeadDutyScheduleId({
      brokerId: "broker-a",
      leadBranchId: "branch-1",
      assignments: [{ id: "assignment-b", brokerId: "broker-a", scheduleId: "schedule-b" }],
      activeScheduleIds: new Set(["schedule-b"]),
      eligibleAssignmentIds: new Set(["assignment-b"]),
      confirmedPresenceAssignmentIds: new Set(),
      branchIdBySchedule: new Map([["schedule-b", "branch-2"]]),
    })).toBeNull();
  });
});
