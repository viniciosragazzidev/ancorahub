import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked database: selects are answered in call order from a queue; writes are recorded.
const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  updates: [] as Array<{ table: unknown; set: Record<string, unknown> }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./roster-broker-account-filter", () => ({ getRosterBrokerAccountFilter: async () => undefined }));
vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ tenantId: "t1", userId: "dir-1", role: "director", branchId: null }),
}));
vi.mock("@/features/system-settings/queries", async () => ({
  FEATURE_FLAGS: (await vi.importActual<typeof import("@/shared/feature-flags/catalog")>("@/shared/feature-flags/catalog")).FEATURE_FLAGS,
  getFeatureFlag: async () => "true",
}));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  const selectChain = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(state.queue.shift() ?? []).then(resolve, reject);
    return chain;
  };
  const tx = {
    execute: async () => [],
    select: selectChain,
    insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => { state.inserts.push({ table, values }); return []; } }),
    update: (table: unknown) => ({ set: (set: Record<string, unknown>) => ({ where: async () => { state.updates.push({ table, set }); return []; } }) }),
  };
  const db = { ...tx, transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) };
  return { ...actual, getDatabase: () => db };
});

import * as schema from "@/shared/db/schema";
import { addBrokerToPublishedOccurrenceAction } from "./monthly-duty-actions";

const FUTURE_DAY = "2099-10-20";
const OCCURRENCE_ID = `sch-1:${FUTURE_DAY}`;

const occurrence = {
  id: OCCURRENCE_ID, scheduleId: "sch-1", scheduleName: "Manhã", dutyDate: FUTURE_DAY, startsAt: "08:00", endsAt: "12:00",
  minimumBrokers: 1, maximumBrokers: 2, allowedBrokerIds: ["bruno"], typeId: "t1", attendanceMode: "any", brokers: [], assignedCount: 0, ended: false,
};

const publishedPlan = {
  id: "plan-9", tenantId: "t1", monthKey: "2099-10", revision: 9, status: "published", occurrences: [occurrence], assignments: [],
  quotas: [], settings: null,
};

const schedule = {
  id: "sch-1", name: "Manhã", branchId: "b1", dayOfWeek: 1, startsAt: "08:00", endsAt: "12:00", minimumBrokers: 1, maximumBrokers: 2,
  timezone: "America/Sao_Paulo", validFrom: new Date("2099-01-01T00:00:00Z"), validUntil: null, attendanceMode: "any", typeId: "t1", typeBranchIds: [],
};

beforeEach(() => {
  state.queue = [];
  state.inserts = [];
  state.updates = [];
});

describe("adicionar corretor a um plantão publicado (ação de servidor)", () => {
  it("refuses to change the published escala while a newer draft exists", async () => {
    state.queue = [[{ ...publishedPlan, id: "plan-10", revision: 10, status: "draft" }]];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/não é a última revisão/);
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(0);
  });

  it("adds the broker as a dated row of the published plan and as a manual entry, without a new revision", async () => {
    state.queue = [
      [publishedPlan],
      [schedule],
      [{ id: "bruno", name: "Bruno", branchId: "b1" }],
      [],
      [],
    ];

    // The view is read at the end; with no plan left in the queue the action reports it, after the writes.
    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/Proposta não encontrada/);

    const rosterInsert = state.inserts.find((item) => item.table === schema.dutyRosterAssignments);
    expect(rosterInsert?.values).toMatchObject({ brokerId: "bruno", scheduleId: "sch-1", dutyDate: FUTURE_DAY, monthlyPlanId: "plan-9", status: "active" });
    expect(state.inserts.some((item) => item.table === schema.dutyScheduleMonthlyPlans)).toBe(false);

    const planUpdate = state.updates.find((item) => item.table === schema.dutyScheduleMonthlyPlans);
    expect(planUpdate?.set.assignments).toEqual([{ occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: rosterInsert?.values.id }]);
  });

  it("refuses a broker who is not an active broker of the tenant", async () => {
    state.queue = [[publishedPlan], [schedule], [{ id: "carla", name: "Carla", branchId: "b1" }], []];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" })).rejects.toThrow(/fora da corretora/);
    expect(state.inserts).toHaveLength(0);
  });

  it("refuses a plantão that already ended", async () => {
    const past = { ...publishedPlan, occurrences: [{ ...occurrence, dutyDate: "2020-01-05", id: "sch-1:2020-01-05" }] };
    state.queue = [[{ ...past, monthKey: "2020-01" }]];

    await expect(addBrokerToPublishedOccurrenceAction({ occurrenceId: "sch-1:2020-01-05", brokerId: "bruno" })).rejects.toThrow(/já terminou/);
    expect(state.inserts).toHaveLength(0);
  });
});
