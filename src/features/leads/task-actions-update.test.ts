import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: { tenantId: "t1", userId: "corretor-a", role: "broker", branchId: "u1" } as Record<string, unknown>,
  task: { id: "00000000-0000-4000-8000-000000000010", leadId: "lead-a", completedAt: null, assignedTo: "corretor-a", tenantId: "t1", branchId: "u1" } as Record<string, unknown> | null,
  updates: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  failUpdate: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("./tarefa-servico", () => ({ criarTarefaDoLead: vi.fn() }));
vi.mock("@/shared/db", () => {
  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => {
        if (state.failUpdate) throw new Error("db down");
        state.updates.push(values);
        return { where: async () => undefined };
      },
    }),
    insert: () => ({ values: async (values: Record<string, unknown>) => { state.inserts.push(values); } }),
  };
  const db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => (state.task ? [state.task] : []) }) }) }) }),
    transaction: async (run: (t: typeof tx) => Promise<void>) => run(tx),
  };
  return { schema: new Proxy({}, { get: () => ({}) }), getDatabase: () => db };
});

const { updateLeadTaskAction } = await import("./task-actions");
const taskId = "00000000-0000-4000-8000-000000000010";

beforeEach(() => {
  state.context = { tenantId: "t1", userId: "corretor-a", role: "broker", branchId: "u1" };
  state.task = { id: taskId, leadId: "lead-a", completedAt: null, assignedTo: "corretor-a", tenantId: "t1", branchId: "u1" };
  state.updates = [];
  state.inserts = [];
  state.failUpdate = false;
});

describe("updateLeadTaskAction", () => {
  it("salva título e prazo e registra auditoria", async () => {
    const result = await updateLeadTaskAction(taskId, { title: "  Cobrar documentos  ", dueAt: "2026-11-27T12:00:00.000Z" });
    expect(result).toEqual({ success: true });
    expect(state.updates).toEqual([{ title: "Cobrar documentos", dueAt: new Date("2026-11-27T12:00:00.000Z") }]);
    expect(state.inserts[0]).toMatchObject({ entidade: "lead_task", entidadeId: taskId, acao: "editou", userId: "corretor-a" });
  });

  it("prazo vazio tira o prazo", async () => {
    await updateLeadTaskAction(taskId, { title: "Retornar cotação", dueAt: null });
    expect(state.updates[0]).toEqual({ title: "Retornar cotação", dueAt: null });
  });

  it("valida id, título e prazo antes de ir ao banco", async () => {
    expect(await updateLeadTaskAction("nao-e-uuid", { title: "Ligar", dueAt: null })).toEqual({ error: "Tarefa inválida." });
    expect((await updateLeadTaskAction(taskId, { title: "ab", dueAt: null })).error).toContain("3 caracteres");
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: "ontem" })).toEqual({ error: "Prazo inválido." });
    expect(state.updates).toHaveLength(0);
  });

  it("corretor não edita tarefa de outro", async () => {
    state.task = { ...state.task, assignedTo: "corretor-b" };
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: null })).toEqual({ error: "Você só pode alterar suas próprias tarefas." });
    expect(state.updates).toHaveLength(0);
  });

  it("gestor só edita tarefa da própria filial", async () => {
    state.context = { tenantId: "t1", userId: "gestor", role: "manager", branchId: "u2" };
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: null })).toEqual({ error: "Esta tarefa não pertence à sua filial." });
    state.context = { tenantId: "t1", userId: "gestor", role: "manager", branchId: "u1" };
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: null })).toEqual({ success: true });
  });

  it("diretor edita qualquer tarefa do tenant", async () => {
    state.context = { tenantId: "t1", userId: "diretor", role: "owner", branchId: null };
    state.task = { ...state.task, assignedTo: "corretor-b", branchId: "u9" };
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: null })).toEqual({ success: true });
  });

  it("tarefa fora do tenant não é encontrada", async () => {
    state.task = null;
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: null })).toEqual({ error: "Tarefa não encontrada." });
  });

  it("falha do banco vira mensagem amigável", async () => {
    state.failUpdate = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await updateLeadTaskAction(taskId, { title: "Ligar", dueAt: null })).toEqual({ error: "Não foi possível salvar a tarefa. Tente de novo." });
  });
});
