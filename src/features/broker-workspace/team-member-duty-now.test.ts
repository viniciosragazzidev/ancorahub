import { beforeEach, describe, expect, it, vi } from "vitest";

// Membership queue (one select) and the roster rows of the broker (one select), answered in call order.
const state = vi.hoisted(() => ({ queue: [] as unknown[][], context: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/broker-workspace/duty-now", () => ({
  loadDutyNow: vi.fn(async (input: { active: { scheduleId: string } }) => ({ scheduleId: input.active.scheduleId, leads: [] })),
}));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  const selectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(state.queue.shift() ?? []).then(resolve, reject);
    return chain;
  };
  return { ...actual, getDatabase: () => ({ select: selectChain }) };
});

import { getBrokerDutyNowForViewer } from "./team-member-duty-now";

// 16/10/2026 12:00 in São Paulo.
const NOON = new Date("2026-10-16T15:00:00.000Z");

const runningRow = { scheduleId: "sch-1", startsAt: "08:00", endsAt: "18:00", pausedAt: null, scheduleName: "Manhã", attendanceMode: "online", queueName: "PME", branchName: "Central" };

function viewer(role: string, extra: Record<string, unknown> = {}) {
  return { tenantId: "t1", userId: "sup-ana", role, branchId: "b1", supervisorTeamScope: role === "supervisor", ...extra };
}

beforeEach(() => {
  state.queue = [];
  state.context = viewer("supervisor");
});

describe("plantão de um corretor visto pelo supervisor, gestor ou diretor", () => {
  it("denies a supervisor a broker of another team", async () => {
    state.queue = [[{ branchId: "b1", supervisorId: "sup-bruno" }]];

    expect(await getBrokerDutyNowForViewer({ brokerId: "carla", now: NOON })).toEqual({ access: "denied" });
  });

  it("denies the gestor a broker of another unit", async () => {
    state.context = viewer("manager");
    state.queue = [[{ branchId: "b2", supervisorId: "sup-x" }]];

    expect(await getBrokerDutyNowForViewer({ brokerId: "carla", now: NOON })).toEqual({ access: "denied" });
  });

  it("denies a broker opening someone else's plantão", async () => {
    state.context = viewer("broker");

    expect(await getBrokerDutyNowForViewer({ brokerId: "carla", now: NOON })).toEqual({ access: "denied" });
  });

  it("opens the running plantão of a broker of the supervisor's own team", async () => {
    state.queue = [[{ branchId: "b1", supervisorId: "sup-ana" }], [runningRow]];

    const result = await getBrokerDutyNowForViewer({ brokerId: "maria", now: NOON });
    expect(result).toMatchObject({ access: "ok", duty: { scheduleId: "sch-1" } });
  });

  it("lets the director see any broker of the tenant", async () => {
    state.context = viewer("director", { supervisorTeamScope: false, branchId: null });
    state.queue = [[{ branchId: "b9", supervisorId: null }], [runningRow]];

    expect(await getBrokerDutyNowForViewer({ brokerId: "maria", now: NOON })).toMatchObject({ access: "ok" });
  });

  it("says idle, not denied, when the broker is in scope but has no plantão running", async () => {
    state.queue = [[{ branchId: "b1", supervisorId: "sup-ana" }], [{ ...runningRow, startsAt: "18:00", endsAt: "22:00" }]];

    expect(await getBrokerDutyNowForViewer({ brokerId: "maria", now: NOON })).toEqual({ access: "idle" });
  });
});
