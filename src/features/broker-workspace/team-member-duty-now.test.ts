import { beforeEach, describe, expect, it, vi } from "vitest";

// Membership (one select) answered from a queue; the duty read is stubbed to test scope and dates.
const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  context: null as unknown,
  running: [] as unknown[],
  loadRows: vi.fn(async () => ({ rows: [], publishedRows: [] })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => undefined }));
vi.mock("@/features/broker-workspace/duty-summary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./duty-summary")>();
  return {
    ...actual,
    loadBrokerDutyRows: state.loadRows,
    buildDutySummary: async () => ({ activeAll: state.running, active: state.running[0] ?? null, next: null, readyToReceive: false, presence: null }),
  };
});
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

// 16/10/2026 02:00 in São Paulo.
const TWO_AM = new Date("2026-10-16T05:00:00.000Z");

const nightDuty = { scheduleId: "sch-night", scheduleName: "Noturno", startsAt: new Date("2026-10-15T22:00:00.000Z"), endsAt: new Date("2026-10-16T10:00:00.000Z") };

function viewer(role: string, extra: Record<string, unknown> = {}) {
  return { tenantId: "t1", userId: "sup-ana", role, branchId: "b1", supervisorTeamScope: role === "supervisor", ...extra };
}

beforeEach(() => {
  state.queue = [];
  state.context = viewer("supervisor");
  state.running = [];
  state.loadRows.mockClear();
});

describe("plantão de um corretor visto pelo supervisor, gestor ou diretor", () => {
  it("denies a supervisor a broker of another team", async () => {
    state.queue = [[{ branchId: "b1", supervisorId: "sup-bruno" }]];

    expect(await getBrokerDutyNowForViewer({ brokerId: "carla", now: TWO_AM })).toEqual({ access: "denied" });
  });

  it("denies the gestor a broker of another unit", async () => {
    state.context = viewer("manager");
    state.queue = [[{ branchId: "b2", supervisorId: "sup-x" }]];

    expect(await getBrokerDutyNowForViewer({ brokerId: "carla", now: TWO_AM })).toEqual({ access: "denied" });
  });

  it("denies a broker opening someone else's plantão", async () => {
    state.context = viewer("broker");

    expect(await getBrokerDutyNowForViewer({ brokerId: "carla", now: TWO_AM })).toEqual({ access: "denied" });
  });

  it("opens a night plantão still running at 02:00, which started yesterday", async () => {
    state.queue = [[{ branchId: "b1", supervisorId: "sup-ana" }]];
    state.running = [nightDuty];

    const result = await getBrokerDutyNowForViewer({ brokerId: "maria", now: TWO_AM });

    expect(result).toMatchObject({ access: "ok", duty: { scheduleId: "sch-night" } });
    // The read starts yesterday, so the night shift that began on the 15th is in it.
    expect(state.loadRows).toHaveBeenCalledWith(expect.objectContaining({ brokerId: "maria", fromDateKey: "2026-10-15" }));
  });

  it("lets the director see any broker of the tenant", async () => {
    state.context = viewer("director", { supervisorTeamScope: false, branchId: null });
    state.queue = [[{ branchId: "b9", supervisorId: null }]];
    state.running = [nightDuty];

    expect(await getBrokerDutyNowForViewer({ brokerId: "maria", now: TWO_AM })).toMatchObject({ access: "ok" });
  });

  it("says idle, not denied, when the broker is in scope but has no plantão running", async () => {
    state.queue = [[{ branchId: "b1", supervisorId: "sup-ana" }]];
    state.running = [];

    expect(await getBrokerDutyNowForViewer({ brokerId: "maria", now: TWO_AM })).toEqual({ access: "idle" });
  });
});
