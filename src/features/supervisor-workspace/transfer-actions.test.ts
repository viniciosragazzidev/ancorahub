import { beforeEach, describe, expect, it, vi } from "vitest";

const mockContext = vi.hoisted(() => vi.fn());
const mockAudience = vi.hoisted(() => vi.fn());
const mockPublish = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({ rows: [] as unknown[][], inserts: [] as Array<{ table: unknown; values: unknown }>, db: null as unknown }));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mockContext }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mockAudience }));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: mockPublish }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, getDatabase: () => state.db };
});

import { schema } from "@/shared/db";
import { requestBrokerTransferAction } from "./transfer-actions";

type Query = {
  from: (...args: unknown[]) => Query;
  innerJoin: (...args: unknown[]) => Query;
  leftJoin: (...args: unknown[]) => Query;
  where: (...args: unknown[]) => Query;
  orderBy: (...args: unknown[]) => Query;
  for: (...args: unknown[]) => Query;
  limit: (n: number) => Promise<unknown[]>;
  then: Promise<unknown[]>["then"];
};

const supervisor = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant-1",
  role: "supervisor",
  branchId: "branch-1",
  supervisorTeamScope: true,
};
const brokerId = "22222222-2222-4222-8222-222222222222";
const previousSupervisorId = "33333333-3333-4333-8333-333333333333";

function setupDatabase() {
  state.rows = [];
  state.inserts = [];
  const makeQuery = () => {
    const rows = state.rows.shift() ?? [];
    const promise = Promise.resolve(rows);
    const query: Query = {
      from: () => query,
      innerJoin: () => query,
      leftJoin: () => query,
      where: () => query,
      orderBy: () => query,
      for: () => query,
      limit: async () => rows,
      then: promise.then.bind(promise),
    };
    return query;
  };
  const db = {
    select: vi.fn(makeQuery),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      select: vi.fn(makeQuery),
      insert: (table: unknown) => ({ values: async (values: unknown) => { state.inserts.push({ table, values }); } }),
      update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) })),
    })),
  };
  state.db = db;
}

beforeEach(() => {
  setupDatabase();
  mockContext.mockResolvedValue(supervisor);
  mockAudience.mockResolvedValue("supervisor");
  mockPublish.mockReset();
  mockPublish.mockResolvedValue(true);
});

describe("supervisor transfer actions", () => {
  it("rejects an empty reason before querying or writing", async () => {
    const result = await requestBrokerTransferAction({ brokerId, reason: "  " });
    expect(result).toEqual({ ok: false, reason: "Informe um motivo de até 1.000 caracteres." });
    expect(state.inserts).toHaveLength(0);
  });

  it("creates an audited request for an active broker assigned to another supervisor", async () => {
    state.rows = [
      [{ userId: supervisor.userId }],
      [{ userId: brokerId, supervisorId: previousSupervisorId }],
      [{ userId: previousSupervisorId }],
      [{ userId: "director-1", role: "director", branchId: null }, { userId: "manager-1", role: "manager", branchId: "branch-1" }],
      [],
    ];

    const result = await requestBrokerTransferAction({ brokerId, reason: "Cobertura de atendimento na equipe." });

    expect(result).toEqual({ ok: true });
    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0]).toMatchObject({
      table: schema.supervisorTransferRequests,
      values: { tenantId: "tenant-1", brokerId, fromSupervisorId: previousSupervisorId, toSupervisorId: supervisor.userId, branchId: "branch-1", status: "pending" },
    });
    expect(state.inserts[1]).toMatchObject({
      table: schema.auditLogs,
      values: { userId: supervisor.userId, entidade: "supervisor_transfer_request", acao: "supervisor_transfer.requested" },
    });
    expect(mockPublish).toHaveBeenCalledTimes(3);
  });

  it("does not let a broker submit a transfer request", async () => {
    mockContext.mockResolvedValue({ ...supervisor, role: "broker" });
    const result = await requestBrokerTransferAction({ brokerId, reason: "Preciso de apoio." });
    expect(result.ok).toBe(false);
    expect(state.inserts).toHaveLength(0);
  });

  it("does not approve a transfer when the destination team already has 30 brokers", async () => {
    mockContext.mockResolvedValue({ ...supervisor, role: "manager", supervisorTeamScope: undefined });
    state.rows = [
      [{ branchId: "branch-1" }],
      [{ id: "request-1", brokerId, fromSupervisorId: previousSupervisorId, toSupervisorId: supervisor.userId, branchId: "branch-1" }],
      [{ userId: brokerId }],
      [{ userId: supervisor.userId }],
      [{ count: 30 }],
    ];
    const { decideBrokerTransferAction } = await import("./transfer-actions");

    const result = await decideBrokerTransferAction("44444444-4444-4444-8444-444444444444", true);

    expect(result).toEqual({ ok: false, reason: "A equipe de destino já tem 30 corretores." });
    expect(state.inserts).toHaveLength(0);
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
