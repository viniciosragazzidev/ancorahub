import { describe, expect, it } from "vitest";
import { getDutyLeadShift, groupDutyLeadsByShift, sortByAssignmentTime } from "./duty-leads-shift-groups";

// São Paulo is UTC-3: 15:59Z = 12:59 local, 16:00Z = 13:00 local.
const lead = (id: string, assignedAt: string | null, createdAt = "2026-09-24T11:00:00.000Z", corretorId: string | null = "broker-1") => ({
  id,
  corretorId: assignedAt ? corretorId : null,
  assignedAt: assignedAt ? new Date(assignedAt) : null,
  createdAt: new Date(createdAt),
});

describe("duty leads shift groups", () => {
  it("cuts at 13:00 São Paulo time, not server/UTC time", () => {
    expect(getDutyLeadShift(lead("a", "2026-09-24T15:59:59.000Z"))).toBe("manha");
    expect(getDutyLeadShift(lead("b", "2026-09-24T16:00:00.000Z"))).toBe("tarde");
    expect(getDutyLeadShift(lead("c", "2026-09-24T02:30:00.000Z"))).toBe("tarde"); // 23:30 local
  });

  it("falls back to the arrival time when nobody was assigned", () => {
    expect(getDutyLeadShift(lead("a", null, "2026-09-24T17:00:00.000Z"))).toBe("tarde");
    expect(getDutyLeadShift(lead("b", null, "2026-09-24T12:00:00.000Z"))).toBe("manha");
  });

  it("ignores a stale assignedAt once the lead has no broker", () => {
    const released = { id: "r", corretorId: null, assignedAt: new Date("2026-09-24T18:00:00.000Z"), createdAt: new Date("2026-09-24T12:00:00.000Z") };
    expect(getDutyLeadShift(released)).toBe("manha");
  });

  it("orders distributed leads by assignment time, earliest first, across both blocks", () => {
    const sorted = sortByAssignmentTime([
      lead("late", "2026-09-25T16:30:00.000Z"),
      lead("first", "2026-09-25T12:01:09.000Z"),
      { id: "no-time", corretorId: "broker", assignedAt: null, createdAt: new Date("2026-09-25T11:00:00.000Z") },
      lead("second", "2026-09-25T12:33:06.000Z"),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["first", "second", "late", "no-time"]);
    expect(groupDutyLeadsByShift(sorted).map((group) => [group.key, group.leads.map((item) => item.id)])).toEqual([
      ["manha", ["first", "second", "no-time"]],
      ["tarde", ["late"]],
    ]);
  });

  it("keeps order inside each block and omits empty blocks", () => {
    const groups = groupDutyLeadsByShift([
      lead("t1", "2026-09-24T19:00:00.000Z"),
      lead("m1", "2026-09-24T14:00:00.000Z"),
      lead("t2", "2026-09-24T16:30:00.000Z"),
    ]);
    expect(groups.map((group) => [group.key, group.leads.map((item) => item.id)])).toEqual([
      ["manha", ["m1"]],
      ["tarde", ["t1", "t2"]],
    ]);
    expect(groupDutyLeadsByShift([lead("m", "2026-09-24T12:00:00.000Z")]).map((group) => group.key)).toEqual(["manha"]);
  });
});
