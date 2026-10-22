import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => { state.inserts.push({ table, values }); return { onConflictDoNothing: async () => [] }; } }),
    update: (table: unknown) => ({ set: (set: Record<string, unknown>) => ({ where: async () => { state.updates.push({ table, set }); return []; } }) }),
  };
  const db = { ...tx, transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) };
  return { ...actual, getDatabase: () => db };
});

import * as schema from "@/shared/db/schema";
import { addBrokerToPublishedOccurrenceAction, removeBrokerFromPublishedOccurrenceAction } from "./monthly-duty-actions";

const DAY = "2099-10-20";
const OCCURRENCE_ID = `sch-1:${DAY}`;
const occurrence = {
  id: OCCURRENCE_ID, scheduleId: "sch-1", scheduleName: "Manhã", dutyDate: DAY, startsAt: "08:00", endsAt: "12:00",
  minimumBrokers: 1, maximumBrokers: 2, allowedBrokerIds: ["bruno"], typeId: "t1", attendanceMode: "any", brokers: [], assignedCount: 0, ended: false,
};
const planWithout = { id: "plan-9", tenantId: "t1", monthKey: "2099-10", revision: 9, status: "published", occurrences: [occurrence], assignments: [], quotas: [], settings: null };
const planWith = { ...planWithout, assignments: [{ occurrenceId: OCCURRENCE_ID, brokerId: "bruno", origin: "manual", rosterAssignmentId: "row-1" }] };
const schedule = {
  id: "sch-1", name: "Manhã", branchId: "b1", dayOfWeek: 1, startsAt: "08:00", endsAt: "12:00", minimumBrokers: 1, maximumBrokers: 2,
  timezone: "America/Sao_Paulo", validFrom: new Date("2099-01-01T00:00:00Z"), validUntil: null, attendanceMode: "any", typeId: "t1", typeBranchIds: [],
};
const bruno = { id: "bruno", name: "Bruno", branchId: "b1" };

function notices() {
  return state.inserts.filter((item) => item.table === schema.notifications);
}

// Each action ends by reading the view; with no plan left in the queue it reports that, after its writes.
async function add() {
  await addBrokerToPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" }).catch(() => undefined);
}
async function remove() {
  await removeBrokerFromPublishedOccurrenceAction({ occurrenceId: OCCURRENCE_ID, brokerId: "bruno" }).catch(() => undefined);
}

beforeEach(() => {
  state.queue = [];
  state.inserts = [];
  state.updates = [];
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2099-10-01T12:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

describe("uma notificação por transição real do plantão", () => {
  it("escalar, escalar de novo = 1 aviso: the repeated add is refused and sends nothing", async () => {
    state.queue = [[planWithout], [planWithout], [schedule], [bruno], [], []];
    await add();
    expect(notices()).toHaveLength(1);

    // Second click: the broker is already on the plantão.
    state.queue = [[planWith], [planWith], [schedule], [bruno], [], [{ id: "row-1", status: "active" }]];
    await add();
    expect(notices()).toHaveLength(1);
  });

  it("escalar, tirar, escalar = 3 avisos, each with its own key", async () => {
    // 1. Escalar.
    state.queue = [[planWithout], [planWithout], [schedule], [bruno], [], []];
    await add();
    vi.setSystemTime(new Date("2099-10-01T12:05:00.000Z"));

    // 2. Tirar: the schedule name and the row are read; the row goes inactive.
    state.queue = [[planWith], [planWith], [{ name: "Manhã" }]];
    await remove();
    vi.setSystemTime(new Date("2099-10-01T12:10:00.000Z"));

    // 3. Escalar de novo: the inactive row comes back.
    state.queue = [[planWithout], [planWithout], [schedule], [bruno], [], [{ id: "row-1" }]];
    await add();

    const sent = notices();
    expect(sent.map((item) => item.values.type)).toEqual(["duty_plantao_added", "duty_plantao_removed", "duty_plantao_added"]);
    expect(new Set(sent.map((item) => item.values.idempotencyKey)).size).toBe(3);
  });
});
