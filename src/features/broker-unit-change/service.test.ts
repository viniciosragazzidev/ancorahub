import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  removeFromPlans: vi.fn(),
  lock: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/features/lead-distribution/monthly-duty-plan-assignments", () => ({ lockMonthlyDutyPlans: mocks.lock, removeDatedRosterAssignmentFromMonthlyPlans: mocks.removeFromPlans }));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: mocks.notify }));

const state = vi.hoisted(() => ({
  selects: new Map<unknown, unknown[][]>(),
  updates: [] as { table: unknown; set: Record<string, unknown>; where: { sql: string; params: unknown[] } }[],
  updateReturns: new Map<unknown, unknown[]>(),
  inserts: [] as { table: unknown; values: unknown }[],
  transactions: 0,
}));

vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  const dialect = new PgDialect();
  const select = () => {
    let table: unknown;
    const chain: Record<string, unknown> = {};
    for (const method of ["innerJoin", "leftJoin", "where", "limit", "orderBy"]) chain[method] = () => chain;
    chain.from = (from: unknown) => { table = from; return chain; };
    chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
      const queue = state.selects.get(table) ?? [];
      return Promise.resolve(queue.shift() ?? []).then(resolve, reject);
    };
    return chain;
  };
  const db = {
    select,
    execute: async () => undefined,
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          state.updates.push({ table, set, where: dialect.sqlToQuery(condition) });
          const done = Promise.resolve(undefined);
          return { returning: async () => state.updateReturns.get(table) ?? [], then: done.then.bind(done) };
        },
      }),
    }),
    insert: (table: unknown) => ({ values: async (values: unknown) => { state.inserts.push({ table, values }); } }),
    transaction: async (fn: (tx: unknown) => unknown) => { state.transactions += 1; return fn(db); },
  };
  return { schema, getDatabase: () => db };
});

import { schema } from "@/shared/db";
import { BrokerUnitChangeError, changeOwnBranch } from "./service";

const broker = { tenantId: "tenant-1", userId: "broker-1", role: "broker" };
const now = new Date("2026-11-09T15:00:00.000Z"); // 12:00 in São Paulo

function arrange(options: { membershipBranch?: string | null; supervisorId?: string | null } = {}) {
  state.selects.set(schema.branches, [[{ id: "unit-b", name: "Unidade B" }], [{ name: "Unidade A" }]]);
  state.selects.set(schema.tenantMemberships, [
    [{ id: "membership-1", branchId: options.membershipBranch === undefined ? "unit-a" : options.membershipBranch, supervisorId: options.supervisorId ?? null }],
    [{ userId: "manager-a", branchId: "unit-a" }, { userId: "manager-b", branchId: "unit-b" }],
  ]);
  state.selects.set(schema.dutyRosterAssignments, [[
    { id: "weekly", scheduleId: "s1", dutyDate: null, startsAt: "08:00", endsAt: "12:00", timezone: "America/Sao_Paulo" },
    { id: "running", scheduleId: "s2", dutyDate: "2026-11-09", startsAt: "10:00", endsAt: "14:00", timezone: "America/Sao_Paulo" },
    { id: "past", scheduleId: "s2", dutyDate: "2026-11-08", startsAt: "10:00", endsAt: "14:00", timezone: "America/Sao_Paulo" },
  ]]);
  state.selects.set(schema.user, [[{ name: "Ana" }]]);
  state.updateReturns.set(schema.tenantMemberships, [{ id: "membership-1" }]);
  state.updateReturns.set(schema.brokerProfiles, [{ id: "profile-1" }]);
}

beforeEach(() => {
  vi.clearAllMocks();
  state.selects.clear(); state.updates.length = 0; state.updateReturns.clear(); state.inserts.length = 0; state.transactions = 0;
  mocks.notify.mockResolvedValue(true);
});

describe("changeOwnBranch", () => {
  it("moves membership and profile, closes open old-unit slots and audits origin and destination", async () => {
    arrange({ supervisorId: "supervisor-1" });
    const result = await changeOwnBranch(broker, "unit-b", now);
    expect(result).toEqual({ branchName: "Unidade B", changed: true, releasedAssignments: 2 });
    expect(mocks.lock).toHaveBeenCalledWith(expect.anything(), "tenant-1");

    const membershipUpdate = state.updates.find((item) => item.table === schema.tenantMemberships)!;
    expect(membershipUpdate.set).toMatchObject({ branchId: "unit-b", supervisorId: null });
    // Only the caller's own active broker membership, still in the unit read before.
    expect(membershipUpdate.where.params).toEqual(["membership-1", "tenant-1", "broker-1", "unit-a", "broker", "active"]);
    expect(state.updates.find((item) => item.table === schema.brokerProfiles)?.set).toMatchObject({ branchId: "unit-b" });

    const slotUpdate = state.updates.find((item) => item.table === schema.dutyRosterAssignments)!;
    expect(slotUpdate.set).toMatchObject({ status: "inactive", updatedBy: "broker-1" });
    expect(slotUpdate.where.params).toEqual(["tenant-1", "broker-1", "active", "weekly", "running"]);
    // The dated slot still running also leaves the monthly escala; the weekly one has no JSON entry.
    expect(mocks.removeFromPlans).toHaveBeenCalledTimes(1);
    expect(mocks.removeFromPlans).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ rosterAssignmentId: "running", dutyDate: "2026-11-09", brokerId: "broker-1" }));

    const audits = state.inserts.filter((item) => item.table === schema.auditLogs).flatMap((item) => (Array.isArray(item.values) ? item.values : [item.values])) as Record<string, unknown>[];
    expect(audits.map((audit) => audit.acao)).toEqual([
      "duty_roster_assignment.removed_by_unit_change",
      "duty_roster_assignment.removed_by_unit_change",
      "corretor_saiu_da_equipe_ao_mudar_unidade",
      "alterou_unidade_propria",
    ]);
    expect(audits.at(-1)).toMatchObject({ userId: "broker-1", entidadeId: "membership-1", metadata: { fromBranchId: "unit-a", fromBranchName: "Unidade A", toBranchId: "unit-b", toBranchName: "Unidade B", releasedAssignmentIds: ["weekly", "running"], supervisorRemoved: true } });
  });

  it("tells the managers of both units", async () => {
    arrange();
    await changeOwnBranch(broker, "unit-b", now);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "manager-a", capability: "broker_unit_change", title: "Ana saiu da unidade Unidade A" }));
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: "manager-b", title: "Ana entrou na unidade Unidade B" }));
  });

  it("keeps the change when a notification fails", async () => {
    arrange();
    mocks.notify.mockRejectedValue(new Error("push down"));
    await expect(changeOwnBranch(broker, "unit-b", now)).resolves.toMatchObject({ changed: true });
  });

  it("does nothing when the broker picks the unit they are already in", async () => {
    arrange({ membershipBranch: "unit-b" });
    expect(await changeOwnBranch(broker, "unit-b", now)).toEqual({ branchName: "Unidade B", changed: false, releasedAssignments: 0 });
    expect(state.transactions).toBe(0);
  });

  it.each(["manager", "director", "supervisor"])("refuses role %s before reading anything", async (role) => {
    await expect(changeOwnBranch({ ...broker, role }, "unit-b", now)).rejects.toBeInstanceOf(BrokerUnitChangeError);
    expect(state.transactions).toBe(0);
  });

  it("refuses an inactive or foreign unit", async () => {
    state.selects.set(schema.branches, [[]]);
    await expect(changeOwnBranch(broker, "unit-x", now)).rejects.toThrow("Escolha uma unidade ativa da sua corretora.");
    expect(state.transactions).toBe(0);
  });

  it("refuses when the broker has no unit to leave", async () => {
    arrange({ membershipBranch: null });
    await expect(changeOwnBranch(broker, "unit-b", now)).rejects.toThrow("Seu cadastro está sem unidade");
  });

  it("stops when the unit changed in another session", async () => {
    arrange();
    state.updateReturns.set(schema.tenantMemberships, []);
    await expect(changeOwnBranch(broker, "unit-b", now)).rejects.toThrow("Sua unidade mudou em outra tela");
    expect(state.inserts).toEqual([]);
  });
});
