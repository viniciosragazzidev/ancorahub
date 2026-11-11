import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ flag: "true" as string, open: null as null | Record<string, unknown>, task: null as null | Record<string, unknown>, updated: true }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: vi.fn(async () => state.flag) }));
vi.mock("@/features/leads/tarefa-servico", () => ({
  autorizarTarefaDoLead: vi.fn(async (context: { tenantId: string; userId: string; role: string }, leadId: string) => {
    if (leadId === "lead-de-outro") throw new Error("Você só pode gerenciar tarefas dos seus leads.");
    return { db: null, lead: { id: leadId, corretorId: context.userId, branchId: null } };
  }),
  criarTarefaDoLead: vi.fn(async () => ({ taskId: "nova-tarefa" })),
}));
vi.mock("./retorno-queries", () => ({
  loadOpenReturnForBroker: vi.fn(async () => state.open),
  loadReturnTask: vi.fn(async () => state.task),
  updateReturnDueAt: vi.fn(async () => state.updated),
}));

const { agendarRetorno, carregarProximaAcao, reagendarRetorno, CarteiraRetornoError } = await import("./retorno-servico");
const { criarTarefaDoLead } = await import("@/features/leads/tarefa-servico");

const corretor = { tenantId: "t1", userId: "corretor-a", role: "broker", jobTitle: null, branchId: "u1", customRoleId: null, supervisorTeamScope: null } as never;
const gestor = { tenantId: "t1", userId: "gestor", role: "manager", jobTitle: null, branchId: "u1", customRoleId: null, supervisorTeamScope: null } as never;
const now = new Date("2026-11-11T17:00:00.000Z");
const futuro = "2026-11-12T13:30:00.000Z";

beforeEach(() => {
  state.flag = "true";
  state.open = null;
  state.task = null;
  state.updated = true;
  vi.mocked(criarTarefaDoLead).mockClear();
});

describe("flag desligada", () => {
  it("nada da carteira responde quando a flag está desligada", async () => {
    state.flag = "false";
    await expect(agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro }, now)).rejects.toBeInstanceOf(CarteiraRetornoError);
    await expect(carregarProximaAcao(corretor, "lead-a")).rejects.toThrow("não está disponível");
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });
});

describe("escopo", () => {
  it("gestor não usa as ações do corretor", async () => {
    await expect(agendarRetorno(gestor, { leadId: "lead-a", dueAt: futuro }, now)).rejects.toThrow("corretor dono");
  });

  it("corretor não agenda em lead de outro corretor", async () => {
    await expect(agendarRetorno(corretor, { leadId: "lead-de-outro", dueAt: futuro }, now)).rejects.toThrow("seus leads");
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("corretor não reagenda retorno de outro corretor", async () => {
    state.task = { id: "t-1", leadId: "lead-a", assignedTo: "outro", dueAt: null, completedAt: null };
    await expect(reagendarRetorno(corretor, { taskId: "t-1", dueAt: futuro }, now)).rejects.toThrow("seus retornos");
  });
});

describe("agendar", () => {
  it("prazo inválido não grava", async () => {
    await expect(agendarRetorno(corretor, { leadId: "lead-a", dueAt: "2026-11-10T10:00" }, now)).rejects.toThrow("futuro");
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("cria a tarefa canônica do corretor", async () => {
    const result = await agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro, note: " ligar depois " }, now);
    expect(result).toEqual({ taskId: "nova-tarefa", repeated: false });
    expect(criarTarefaDoLead).toHaveBeenCalledWith(corretor, expect.objectContaining({ leadId: "lead-a", title: "Retorno", assigneeIds: ["corretor-a"], description: "ligar depois" }));
  });

  it("repetição idêntica (duplo clique) não cria outra tarefa", async () => {
    state.open = { id: "ja-criada", title: "Retorno", dueAt: new Date(futuro), createdAt: new Date(now.getTime() - 10_000), createdBy: "corretor-a", completedAt: null };
    const result = await agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro }, now);
    expect(result).toEqual({ taskId: "ja-criada", repeated: true });
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });
});

describe("reagendar", () => {
  it("mesmo prazo não grava nada", async () => {
    state.task = { id: "t-1", leadId: "lead-a", assignedTo: "corretor-a", dueAt: new Date(futuro), completedAt: null };
    expect(await reagendarRetorno(corretor, { taskId: "t-1", dueAt: futuro }, now)).toEqual({ changed: false });
  });

  it("retorno concluído não é reagendado", async () => {
    state.task = { id: "t-1", leadId: "lead-a", assignedTo: "corretor-a", dueAt: null, completedAt: now };
    await expect(reagendarRetorno(corretor, { taskId: "t-1", dueAt: futuro }, now)).rejects.toThrow("já foi concluído");
  });

  it("corrida: se a tarefa mudou antes do UPDATE, avisa em vez de gravar", async () => {
    state.task = { id: "t-1", leadId: "lead-a", assignedTo: "corretor-a", dueAt: null, completedAt: null };
    state.updated = false;
    await expect(reagendarRetorno(corretor, { taskId: "t-1", dueAt: futuro }, now)).rejects.toThrow("Atualize a ficha");
  });

  it("reagenda quando o prazo muda", async () => {
    state.task = { id: "t-1", leadId: "lead-a", assignedTo: "corretor-a", dueAt: null, completedAt: null };
    expect(await reagendarRetorno(corretor, { taskId: "t-1", dueAt: futuro }, now)).toEqual({ changed: true });
  });
});

describe("próxima ação", () => {
  it("sem retorno aberto, responde nenhum retorno", async () => {
    const view = await carregarProximaAcao(corretor, "lead-a");
    expect(view.state).toBe("none");
  });
});
