import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ getDatabaseCalls: 0, selectQueue: [] as unknown[][], transactionCalls: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({
  schema: new Proxy({}, { get: () => ({}) }),
  getDatabase: () => {
    state.getDatabaseCalls += 1;
    throw new Error("getDatabase não deve ser chamado quando há executor");
  },
}));

const { criarTarefaDoLead } = await import("./tarefa-servico");

/** Resultado encadeável: select().from().where().limit() etc. devolvem a mesma cadeia até o await. */
function chain(result: unknown) {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => (prop === "then" ? (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise.resolve(result).then(resolve, reject) : proxy),
    apply: () => proxy,
  };
  const proxy: unknown = new Proxy(function () {}, handler);
  return proxy;
}

const corretor = { tenantId: "t1", userId: "corretor-a", role: "broker", jobTitle: null, branchId: "u1", customRoleId: null, supervisorTeamScope: null } as never;

function executorWith(selects: unknown[][]) {
  state.selectQueue = [...selects];
  return {
    select: vi.fn(() => chain(state.selectQueue.shift() ?? [])),
    insert: vi.fn(() => chain(undefined)),
  };
}

beforeEach(() => {
  state.getDatabaseCalls = 0;
  state.selectQueue = [];
});

describe("criarTarefaDoLead com executor", () => {
  it("grava dentro do executor recebido, sem pedir conexão ao pool", async () => {
    const executor = executorWith([
      [{ id: "lead-a", corretorId: "corretor-a", branchId: "u1" }],
      [{ userId: "corretor-a" }],
    ]);
    const result = await criarTarefaDoLead(corretor, { leadId: "lead-a", title: "Retorno", priority: "normal", assigneeIds: ["corretor-a"] }, executor as never);
    expect(result.taskId).toBeTruthy();
    expect(state.getDatabaseCalls).toBe(0);
    // Tarefa, responsáveis e auditoria, todos no executor.
    expect(executor.insert).toHaveBeenCalledTimes(3);
  });
});
