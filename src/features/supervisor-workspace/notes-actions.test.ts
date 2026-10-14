import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetContext = vi.hoisted(() => vi.fn());
const mockGetLiteAudience = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({
  selectRows: [] as unknown[][],
  inserts: [] as Array<{ table: unknown; payload: unknown }>,
  database: null as unknown,
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mockGetContext }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mockGetLiteAudience }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, getDatabase: () => mockState.database };
});

import { getDatabase, schema } from "@/shared/db";
import { addSupervisorNoteAction, listBrokerNotes } from "./notes-actions";

type MockQuery = {
  from: (table: unknown) => MockQuery;
  innerJoin: (...args: unknown[]) => MockQuery;
  where: (...args: unknown[]) => MockQuery;
  limit: (count: number) => Promise<unknown[]>;
  orderBy: (...args: unknown[]) => MockQuery;
  then: Promise<unknown[]>["then"];
};

const supervisorContext = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant-1",
  role: "supervisor",
  supervisorTeamScope: true,
  branchId: "branch-1",
};
// Real user ids are text, not always UUIDs (Vigia T43).
const activeTeamBroker = { userId: "user_broker_ana" };

function configureDatabase() {
  mockState.selectRows = [];
  mockState.inserts = [];
  const db = {
    select: vi.fn(() => {
      const rows = mockState.selectRows.shift() ?? [];
      const rowsPromise = Promise.resolve(rows);
      const query: MockQuery = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: async () => rows,
        orderBy: () => query,
        then: rowsPromise.then.bind(rowsPromise),
      };
      return query;
    }),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: (table: unknown) => ({
          values: (payload: unknown) => {
            mockState.inserts.push({ table, payload });
            return {
              returning: async () => {
                if (table !== schema.supervisorNotes) return [];
                const value = payload as { id: string; kind: string; body: string };
                return [{ ...value, createdAt: new Date("2026-10-10T12:00:00.000Z") }];
              },
            };
          },
        }),
      };
      return callback(tx);
    }),
  };
  mockState.database = db as unknown as ReturnType<typeof getDatabase>;
}

beforeEach(() => {
  configureDatabase();
  mockGetContext.mockResolvedValue(supervisorContext);
  mockGetLiteAudience.mockResolvedValue("supervisor");
});

describe("supervisor notes actions", () => {
  it("validates the feedback before looking up a broker", async () => {
    const result = await addSupervisorNoteAction({ brokerId: "invalid", kind: "elogio", body: "" });

    expect(result).toEqual({ ok: false, message: "Escreva um feedback de até 1.000 caracteres." });
    expect(getDatabase().select).not.toHaveBeenCalled();
    expect(mockState.inserts).toHaveLength(0);
  });

  it("creates an in-team note and an audit event in the same transaction", async () => {
    mockState.selectRows = [[activeTeamBroker]];

    const result = await addSupervisorNoteAction({
      brokerId: activeTeamBroker.userId,
      kind: "orientacao",
      body: "  Conversar sobre o primeiro contato.  ",
    });

    expect(result).toMatchObject({
      ok: true,
      note: { kind: "orientacao", body: "Conversar sobre o primeiro contato.", createdAt: "2026-10-10T12:00:00.000Z" },
    });
    expect(mockState.inserts).toHaveLength(2);
    expect(mockState.inserts[0]).toMatchObject({
      table: schema.supervisorNotes,
      payload: {
        tenantId: "tenant-1",
        supervisorId: supervisorContext.userId,
        brokerId: activeTeamBroker.userId,
        body: "Conversar sobre o primeiro contato.",
      },
    });
    expect(mockState.inserts[1]).toMatchObject({
      table: schema.auditLogs,
      payload: { entidade: "supervisor_note", acao: "supervisor_note.created" },
    });
  });

  it("allows the Lite manager to leave feedback only for a broker in the manager unit", async () => {
    mockGetLiteAudience.mockResolvedValue("manager");
    mockGetContext.mockResolvedValue({ ...supervisorContext, userId: "manager-1", role: "manager", supervisorTeamScope: undefined });
    mockState.selectRows = [[activeTeamBroker]];
    const result = await addSupervisorNoteAction({ brokerId: activeTeamBroker.userId, kind: "elogio", body: "Bom acompanhamento." });
    expect(result.ok).toBe(true);
    expect(mockState.inserts[0]).toMatchObject({ payload: { tenantId: "tenant-1", supervisorId: "manager-1", brokerId: activeTeamBroker.userId } });
  });

  it("does not create a note for a broker outside the supervisor's active team", async () => {
    mockState.selectRows = [[]];

    const result = await addSupervisorNoteAction({ brokerId: activeTeamBroker.userId, kind: "alerta", body: "Acompanhar retorno." });

    expect(result).toEqual({ ok: false, message: "Este corretor não está ativo na sua equipe." });
    expect(mockState.inserts).toHaveLength(0);
  });

  it("honors the supervisor Lite feature flag before creating feedback", async () => {
    mockGetLiteAudience.mockResolvedValue(false);

    const result = await addSupervisorNoteAction({ brokerId: activeTeamBroker.userId, kind: "alerta", body: "Acompanhar retorno." });

    expect(result).toEqual({ ok: false, message: "O feedback não está disponível agora." });
    expect(getDatabase().select).not.toHaveBeenCalled();
    expect(mockState.inserts).toHaveLength(0);
  });

  it("lists tenant notes for a manager within their own unit", async () => {
    mockGetContext.mockResolvedValue({ ...supervisorContext, userId: "manager-1", role: "manager", supervisorTeamScope: undefined });
    const createdAt = new Date("2026-10-10T12:00:00.000Z");
    mockState.selectRows = [[activeTeamBroker], [{ id: "note-1", kind: "elogio", body: "Boa escuta.", createdAt }]];

    await expect(listBrokerNotes(activeTeamBroker.userId)).resolves.toEqual([
      { id: "note-1", kind: "elogio", body: "Boa escuta.", createdAt: "2026-10-10T12:00:00.000Z" },
    ]);
  });
});
