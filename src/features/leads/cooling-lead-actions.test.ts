/** Escopo das ações do radar Esfriando no servidor: quem pode agir e a tarefa de cobrança pelo serviço de tarefas. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: {} as Record<string, unknown>,
  lead: null as Record<string, unknown> | null,
  team: [] as Array<{ userId: string }>,
  openTask: [] as Array<{ id: string }>,
  calls: 0,
}));

// Cada select devolve, em ordem: o lead, a equipe (supervisor) e a tarefa de cobrança aberta.
function chain(result: () => unknown[]) {
  const node: Record<string, unknown> = {};
  for (const key of ["from", "leftJoin", "innerJoin", "where", "orderBy"]) node[key] = () => node;
  node.limit = async () => result();
  node.then = (resolve: (value: unknown) => void) => resolve(result());
  return node;
}
const db = {
  select: (fields: Record<string, unknown>) => chain(() => {
    if ("userId" in fields) return state.team;
    if ("nome" in fields) return state.lead ? [state.lead] : [];
    return state.openTask;
  }),
};

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => db, schema: new Proxy({}, { get: () => new Proxy({}, { get: (_t, key) => ({ column: key }) }) }) }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("drizzle-orm", () => ({ and: () => ({}), asc: () => ({}), eq: () => ({}), inArray: () => ({}), isNull: () => ({}), like: () => ({}), sql: () => ({}) }));
vi.mock("./cooling-radar-query", () => ({ leadLastContactAtSql: { column: "lastContactAt" } }));
vi.mock("@/features/lead-distribution/active-queue-duty-roster", () => ({ getActiveQueueDutyRoster: vi.fn() }));
vi.mock("@/features/manager-scope/unit-brokers", () => ({ getUnitBrokerIds: vi.fn() }));
vi.mock("@/features/notifications/send-push-helper", () => ({ notifyLeadReassigned: vi.fn(async () => undefined) }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async () => null) }));
vi.mock("./management-actions", () => ({ reassignLeadAction: vi.fn() }));
vi.mock("./publish-lead-invalidation", () => ({ publishLeadInvalidation: vi.fn(async () => undefined) }));
const tasks = vi.hoisted(() => ({ criarTarefaDoLead: vi.fn(async () => ({ taskId: "t1" })) }));
vi.mock("./tarefa-servico", () => tasks);

import { assumeCoolingLeadAction, nudgeCoolingBrokerAction } from "./cooling-lead-actions";

const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  state.lead = {
    id: "l1", nome: "Maria Parada", status: "quote_sent", corretorId: "c1", corretorNome: "Ana Souza", branchId: "b1", queueId: null, webhookCredentialId: null,
    createdAt: new Date(Date.now() - 30 * DAY), assignedAt: null, stageEnteredAt: null, lastContactAt: new Date(Date.now() - 4 * DAY - 3_600_000),
  };
  state.team = [];
  state.openTask = [];
});

describe("ações do Esfriando no servidor", () => {
  it("corretor não age, nem no lead dele", async () => {
    state.context = { tenantId: "t1", userId: "c1", role: "broker", branchId: "b1" };
    expect(await assumeCoolingLeadAction("l1")).toEqual({ ok: false, message: "Só diretor, gestor e supervisor agem nos leads parados." });
    expect(await nudgeCoolingBrokerAction("l1")).toMatchObject({ ok: false });
    expect(tasks.criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("gestor de outra unidade fica fora do escopo", async () => {
    state.context = { tenantId: "t1", userId: "g2", role: "manager", branchId: "b2" };
    expect(await nudgeCoolingBrokerAction("l1")).toEqual({ ok: false, message: "Este lead está fora do seu escopo." });
    expect(tasks.criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("supervisor só cobra corretor da equipe", async () => {
    state.context = { tenantId: "t1", userId: "s1", role: "supervisor", branchId: "b1", supervisorTeamScope: true };
    state.team = [{ userId: "c7" }];
    expect(await nudgeCoolingBrokerAction("l1")).toEqual({ ok: false, message: "Este lead está fora do seu escopo." });
    state.team = [{ userId: "c1" }];
    expect(await nudgeCoolingBrokerAction("l1")).toMatchObject({ ok: true });
  });

  it("cobrar cria a tarefa para o corretor com o nome do lead e há quanto tempo está parado", async () => {
    state.context = { tenantId: "t1", userId: "g1", role: "manager", branchId: "b1" };
    const result = await nudgeCoolingBrokerAction("l1");
    expect(result).toEqual({ ok: true, message: "Tarefa criada para Ana Souza." });
    expect(tasks.criarTarefaDoLead).toHaveBeenCalledWith(state.context, expect.objectContaining({
      leadId: "l1",
      title: "Retomar contato com Maria Parada",
      description: "Lead parado há 4 dias. Pedido do gestor no radar Esfriando.",
      assigneeIds: ["c1"],
    }));
  });

  it("não cobra de novo enquanto a tarefa de cobrança está aberta", async () => {
    state.context = { tenantId: "t1", userId: "d1", role: "director", branchId: null };
    state.openTask = [{ id: "old" }];
    expect(await nudgeCoolingBrokerAction("l1")).toEqual({ ok: false, message: "O corretor já foi cobrado. A tarefa continua aberta.", retryable: false });
    expect(tasks.criarTarefaDoLead).not.toHaveBeenCalled();
  });
});
