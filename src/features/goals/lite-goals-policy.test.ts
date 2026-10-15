import { describe, expect, it } from "vitest";

import { liteGoalTargetAllowed, periodBounds } from "./lite-goals-policy";

const sameBranch = { viewerUserId: "sup-ana", viewerBranchId: "branch-1" };
const ownBroker = { role: "broker" as const, userId: "b-1", status: "active", branchId: "branch-1", supervisorId: "sup-ana" };

describe("quem pode definir meta no Lite", () => {
  it("lets the supervisor set their own team goal and their own brokers' goals", () => {
    expect(liteGoalTargetAllowed({ audience: "supervisor", ...sameBranch, scope: "team", target: { role: "supervisor", userId: "sup-ana", status: "active", branchId: "branch-1", supervisorId: null } })).toBe(true);
    expect(liteGoalTargetAllowed({ audience: "supervisor", ...sameBranch, scope: "broker", target: ownBroker })).toBe(true);
  });

  it("blocks the supervisor from another team's broker or another supervisor's team", () => {
    expect(liteGoalTargetAllowed({ audience: "supervisor", ...sameBranch, scope: "broker", target: { ...ownBroker, supervisorId: "sup-bruno" } })).toBe(false);
    expect(liteGoalTargetAllowed({ audience: "supervisor", ...sameBranch, scope: "team", target: { role: "supervisor", userId: "sup-bruno", status: "active", branchId: "branch-1", supervisorId: null } })).toBe(false);
  });

  it("lets the gestor set team goals in the unit only, never a broker goal", () => {
    const team = { role: "supervisor" as const, userId: "sup-bruno", status: "active", branchId: "branch-1", supervisorId: null };
    expect(liteGoalTargetAllowed({ audience: "manager", viewerUserId: "mgr", viewerBranchId: "branch-1", scope: "team", target: team })).toBe(true);
    expect(liteGoalTargetAllowed({ audience: "manager", viewerUserId: "mgr", viewerBranchId: "branch-1", scope: "team", target: { ...team, branchId: "branch-2" } })).toBe(false);
    expect(liteGoalTargetAllowed({ audience: "manager", viewerUserId: "mgr", viewerBranchId: "branch-1", scope: "broker", target: ownBroker })).toBe(false);
  });

  it("refuses inactive targets and viewers outside the Lite", () => {
    expect(liteGoalTargetAllowed({ audience: "supervisor", ...sameBranch, scope: "broker", target: { ...ownBroker, status: "disabled" } })).toBe(false);
    expect(liteGoalTargetAllowed({ audience: null, ...sameBranch, scope: "broker", target: ownBroker })).toBe(false);
  });
});

describe("período da meta", () => {
  it("covers the whole month in São Paulo time", () => {
    expect(periodBounds("2026-02")).toEqual({ startDate: "2026-02-01T00:00:00-03:00", endDate: "2026-02-28T23:59:59-03:00" });
    expect(periodBounds("2026-10")?.endDate).toBe("2026-10-31T23:59:59-03:00");
  });

  it("rejects malformed periods", () => {
    expect(periodBounds("2026-13")).toBeNull();
    expect(periodBounds("outubro")).toBeNull();
  });
});
