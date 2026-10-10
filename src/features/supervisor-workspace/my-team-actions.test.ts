import { beforeEach, describe, expect, it, vi } from "vitest";

const mockContext = vi.hoisted(() => vi.fn());
const mockAudience = vi.hoisted(() => vi.fn());
const mockPublish = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  updates: [] as unknown[][],
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  sets: [] as unknown[],
  lastError: null as unknown,
  db: null as unknown,
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mockContext }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mockAudience }));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: mockPublish }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, getDatabase: () => state.db };
});

import { schema } from "@/shared/db";
import { acceptSupervisorTeamInviteAction, inviteBrokerToMyTeamAction, saveMySupervisorTeamAction } from "./my-team-actions";

type Query = {
  from: (...args: unknown[]) => Query;
  innerJoin: (...args: unknown[]) => Query;
  where: (...args: unknown[]) => Query;
  limit: (size: number) => Promise<unknown[]>;
  for: (...args: unknown[]) => Query;
  returning: (...args: unknown[]) => Promise<unknown[]>;
  then: Promise<unknown[]>["then"];
};

const supervisor = { userId: "supervisor-1", tenantId: "tenant-1", role: "supervisor", branchId: "branch-1", supervisorTeamScope: true };
const brokerId = "broker-user-id-text";
const inviteId = "invite-id-text";

function setupDatabase() {
  state.rows = [];
  state.updates = [];
  state.inserts = [];
  state.sets = [];
  state.lastError = null;
  const makeQuery = (): Query => {
    const rows = state.rows.shift() ?? [];
    const promise = Promise.resolve(rows);
    const query = {
      from: () => query,
      innerJoin: () => query,
      where: () => query,
      limit: async () => rows,
      for: () => query,
      returning: async () => state.updates.shift() ?? [],
      then: promise.then.bind(promise),
    } as Query;
    return query;
  };
  const insert = (table: unknown) => {
    const builder = {
      values(values: unknown) { state.inserts.push({ table, values }); return builder; },
      onConflictDoUpdate: async () => undefined,
      then: (resolve?: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  };
  const update = (table: unknown) => {
    const builder = {
      set(values: unknown) { state.sets.push({ table, values }); return builder; },
      where: () => builder,
      returning: async () => state.updates.shift() ?? [],
    };
    return builder;
  };
  const tx = { select: vi.fn(makeQuery), insert, update };
  state.db = {
    select: vi.fn(makeQuery),
    insert,
    update,
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      try { return await callback(tx); } catch (error) { state.lastError = error; throw error; }
    }),
  };
}

beforeEach(() => {
  setupDatabase();
  mockContext.mockResolvedValue(supervisor);
  mockAudience.mockResolvedValue("supervisor");
  mockPublish.mockReset().mockResolvedValue(true);
});

describe("supervisor team profile and invite actions", () => {
  it("rejects an invalid image before database access", async () => {
    const result = await saveMySupervisorTeamAction({ name: "Equipe A", description: "", imageUrl: "data:image/svg+xml;base64,PHN2Zz4=" });
    expect(result.ok).toBe(false);
    expect((state.db as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();
  });

  it("creates an audited invitation for a free active broker in the same unit", async () => {
    state.rows = [
      [{ id: "team-1", name: "Equipe Norte" }],
      [{ id: "supervisor-membership" }],
      [{ userId: brokerId, name: "Corretor Exemplo" }],
      [],
      [{ total: 2 }],
    ];

    const result = await inviteBrokerToMyTeamAction({ brokerId });
    expect(result).toEqual({ ok: true, message: "Convite enviado para Corretor Exemplo." });
    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0]).toMatchObject({
      table: schema.supervisorTeamInvites,
      values: { tenantId: "tenant-1", branchId: "branch-1", supervisorId: supervisor.userId, brokerId, status: "pending" },
    });
    expect(state.inserts[1]).toMatchObject({ table: schema.auditLogs, values: { acao: "supervisor_team_invite.created" } });
    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({
      capability: "supervisor_team_invite",
      recipientUserId: brokerId,
      title: "Convite para a equipe Equipe Norte",
      pushBody: "Abra as notificações para aceitar ou recusar o convite.",
    }));
  });

  it("cancels an invitation when the broker is no longer free instead of assigning them", async () => {
    mockContext.mockResolvedValue({ ...supervisor, role: "broker", branchId: "branch-1", supervisorTeamScope: undefined });
    state.rows = [
      [{ id: inviteId, supervisorId: supervisor.userId, branchId: "branch-1" }],
      [{ id: "membership-1", supervisorId: "other-supervisor", branchId: "branch-1", role: "broker", status: "active" }],
    ];
    state.updates = [[]];

    const result = await acceptSupervisorTeamInviteAction(inviteId);

    expect(result).toEqual({ ok: false, message: "O convite foi cancelado porque você já entrou em outra equipe." });
    expect(state.sets).toContainEqual({ table: schema.supervisorTeamInvites, values: expect.objectContaining({ status: "cancelled" }) });
    expect(state.inserts).toContainEqual({ table: schema.auditLogs, values: expect.objectContaining({ acao: "supervisor_team_invite.cancelled_on_accept" }) });
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("accepts an active same-unit invitation under the locked supervisor limit", async () => {
    mockContext.mockResolvedValue({ ...supervisor, role: "broker", branchId: "branch-1", supervisorTeamScope: undefined });
    state.rows = [
      [{ id: inviteId, supervisorId: supervisor.userId, branchId: "branch-1" }],
      [{ id: "membership-1", supervisorId: null, branchId: "branch-1", role: "broker", status: "active" }],
      [{ id: "supervisor-membership" }],
      [{ total: 29 }],
      [{ userId: brokerId }],
    ];
    state.updates = [[{ userId: brokerId }], []];

    const result = await acceptSupervisorTeamInviteAction(inviteId);

    expect(result).toEqual({ ok: true, message: "Você entrou na equipe." });
    expect(state.sets).toContainEqual({ table: schema.tenantMemberships, values: expect.objectContaining({ supervisorId: supervisor.userId }) });
    expect(state.sets).toContainEqual({ table: schema.supervisorTeamInvites, values: expect.objectContaining({ status: "accepted" }) });
    expect(state.inserts).toContainEqual({ table: schema.auditLogs, values: expect.objectContaining({ acao: "supervisor_team_invite.accepted" }) });
    expect(mockPublish).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: supervisor.userId, capability: "supervisor_team_invite" }));
  });
});
