import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  targetRows: [] as unknown[],
  inserts: 0,
  updates: 0,
}));
const mockContext = vi.hoisted(() => vi.fn());
const mockAudience = vi.hoisted(() => vi.fn());
const mockFlag = vi.hoisted(() => vi.fn());
const mockCalc = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mockContext }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mockAudience }));
vi.mock("@/features/team-management-ui/flag", () => ({ isTeamManagementEnabled: mockFlag }));
vi.mock("./goals-service", () => ({ calculateGoalProgress: mockCalc }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  const chain = (rows: unknown[]) => {
    const query = { from: () => query, innerJoin: () => query, where: () => query, limit: async () => rows };
    return query;
  };
  return {
    ...actual,
    getDatabase: () => ({
      select: () => chain(mockState.targetRows),
      insert: () => ({ values: async () => { mockState.inserts += 1; } }),
      update: () => ({ set: () => ({ where: async () => { mockState.updates += 1; } }) }),
    }),
  };
});

import { saveLiteGoalAction } from "./lite-goals-actions";

const supervisor = { userId: "sup-ana", tenantId: "t1", role: "supervisor", branchId: "branch-1", supervisorTeamScope: true };

beforeEach(() => {
  mockState.targetRows = [];
  mockState.inserts = 0;
  mockState.updates = 0;
  mockContext.mockResolvedValue(supervisor);
  mockAudience.mockResolvedValue("supervisor");
  mockFlag.mockResolvedValue(true);
  mockCalc.mockReset();
  mockCalc.mockResolvedValue(undefined);
});

const valid = { scope: "team", scopeId: "sup-ana", name: "Cotações de outubro", targetType: "quotes_count", targetValue: 8, period: "2026-10" };

describe("saveLiteGoalAction", () => {
  it("refuses a target outside the viewer's scope and writes nothing", async () => {
    mockState.targetRows = [{ role: "broker", status: "active", branchId: "branch-1", supervisorId: "sup-bruno" }];

    const result = await saveLiteGoalAction({ ...valid, scope: "broker", scopeId: "b-9" });

    expect(result).toEqual({ ok: false, message: "Este alvo não está no seu escopo." });
    expect(mockState.inserts).toBe(0);
    expect(mockCalc).not.toHaveBeenCalled();
  });

  it("refuses when the goal flag is off", async () => {
    mockFlag.mockResolvedValue(false);

    expect(await saveLiteGoalAction(valid)).toEqual({ ok: false, message: "A gestão de equipes está desligada." });
  });

  it("refuses a malformed period before touching the database", async () => {
    const result = await saveLiteGoalAction({ ...valid, period: "outubro" });

    expect(result.ok).toBe(false);
    expect(mockState.inserts).toBe(0);
  });

  it("saves the team goal of the supervisor's own team and recalculates it in the viewer's scope", async () => {
    mockState.targetRows = [{ role: "supervisor", status: "active", branchId: "branch-1", supervisorId: null }];

    const result = await saveLiteGoalAction(valid);

    expect(result.ok).toBe(true);
    expect(mockState.inserts).toBe(1);
    expect(mockCalc).toHaveBeenCalledWith(expect.any(String), supervisor);
  });
});
