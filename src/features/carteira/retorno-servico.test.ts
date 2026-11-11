import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  flag: "true" as string,
  owner: { corretorId: "corretor-a" as string | null } as { corretorId: string | null } | null,
  open: null as null | Record<string, unknown>,
  twin: null as null | Record<string, unknown>,
  task: null as null | Record<string, unknown>,
  updated: true,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: vi.fn(async () => state.flag) }));
vi.mock("@/features/leads/tarefa-servico", () => ({
  autorizarTarefaDoLead: vi.fn(async (context: { userId: string }, leadId: string) => {
    if (leadId === "lead-de-outro") throw new Error("Você só pode gerenciar tarefas dos seus leads.");
    return { db: null, lead: { id: leadId, corretorId: context.userId, branchId: null } };
  }),
  criarTarefaDoLead: vi.fn(async () => ({ taskId: "nova-tarefa" })),
}));
vi.mock("./retorno-queries", () => ({
  loadLeadOwner: vi.fn(async () => state.owner),
  loadOpenReturnForBroker: vi.fn(async () => state.open),
  findRecentEquivalentReturn: vi.fn(async () => state.twin),
  loadReturnTask: vi.fn(async () => state.task),
  updateReturnDueAt: vi.fn(async () => state.updated),
  withReturnCreateLock: vi.fn(async (_t: string, _l: string, _u: string, work: () => Promise<unknown>) => work()),
}));

const { agendarRetorno, carregarProximaAcao, reagendarRetorno, CarteiraRetornoError } = await import("./retorno-servico");
const { criarTarefaDoLead } = await import("@/features/leads/tarefa-servico");
const { withReturnCreateLock } = await import("./retorno-queries");

const corretor = { tenantId: "t1", userId: "corretor-a", role: "broker", jobTitle: null, branchId: "u1", customRoleId: null, supervisorTeamScope: null } as never;
const gestor = { tenantId: "t1", userId: "gestor", role: "manager", jobTitle: null, branchId: "u1", customRoleId: null, supervisorTeamScope: null } as never;
const now = new Date("2026-11-11T17:00:00.000Z");
const futuro = "2026-11-12T13:30:00.000Z";

beforeEach(() => {
  state.flag = "true";
  state.owner = { corretorId: "corretor-a" };
  state.open = null;
  state.twin = null;
  state.task = null;
  state.updated = true;
  vi.mocked(criarTarefaDoLead).mockClear();
  vi.mocked(withReturnCreateLock).mockClear();
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

describe("transferência de dono", () => {
  it("lead que saiu da carteira vira estado próprio, sem ações e sem falha", async () => {
    state.owner = { corretorId: "outro-corretor" };
    const view = await carregarProximaAcao(corretor, "lead-a");
    expect(view.state).toBe("not_owner");
    expect(view.reason).toBe("Este cliente não está mais na sua carteira.");
    expect(view.taskId).toBeNull();
  });

  it("lead inexistente no tenant é erro de negócio, não estado de dono", async () => {
    state.owner = null;
    await expect(carregarProximaAcao(corretor, "lead-x")).rejects.toThrow("Lead não encontrado");
  });
});

describe("data sem fuso", () => {
  it("data sem fuso é recusada antes de gravar", async () => {
    await expect(agendarRetorno(corretor, { leadId: "lead-a", dueAt: "2026-11-12T10:30" }, now)).rejects.toThrow("sem fuso");
    expect(withReturnCreateLock).not.toHaveBeenCalled();
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("data com fuso explícito é aceita", async () => {
    await agendarRetorno(corretor, { leadId: "lead-a", dueAt: "2026-11-12T10:30:00-03:00" }, now);
    expect(criarTarefaDoLead).toHaveBeenCalledWith(corretor, expect.objectContaining({ dueAt: "2026-11-12T13:30:00.000Z" }));
  });
});

describe("agendar", () => {
  it("prazo no passado não grava", async () => {
    await expect(agendarRetorno(corretor, { leadId: "lead-a", dueAt: "2026-11-10T10:00:00-03:00" }, now)).rejects.toThrow("futuro");
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("cria a tarefa canônica do corretor dentro da trava", async () => {
    const result = await agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro, note: " ligar depois " }, now);
    expect(result).toEqual({ taskId: "nova-tarefa", repeated: false });
    expect(withReturnCreateLock).toHaveBeenCalledWith("t1", "lead-a", "corretor-a", expect.any(Function));
    expect(criarTarefaDoLead).toHaveBeenCalledWith(corretor, expect.objectContaining({ leadId: "lead-a", title: "Retorno", assigneeIds: ["corretor-a"], description: "ligar depois" }));
  });

  it("repetição de tarefa igual criada há pouco não cria outra", async () => {
    state.twin = { id: "ja-criada", title: "Retorno", dueAt: new Date(futuro), createdAt: new Date(now.getTime() - 10_000), completedAt: null };
    const result = await agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro }, now);
    expect(result).toEqual({ taskId: "ja-criada", repeated: true });
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("tarefa igual criada há pouco por outra pessoa também conta como repetição", async () => {
    state.twin = { id: "ja-criada-por-outro", title: "Retorno", dueAt: new Date(futuro), createdAt: new Date(now.getTime() - 5_000), completedAt: null };
    const result = await agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro }, now);
    expect(result.repeated).toBe(true);
    expect(criarTarefaDoLead).not.toHaveBeenCalled();
  });

  it("tarefa igual antiga (fora da janela) não bloqueia um novo agendamento", async () => {
    state.twin = { id: "antiga", title: "Retorno", dueAt: new Date(futuro), createdAt: new Date(now.getTime() - 60 * 60_000), completedAt: null };
    const result = await agendarRetorno(corretor, { leadId: "lead-a", dueAt: futuro }, now);
    expect(result.repeated).toBe(false);
    expect(criarTarefaDoLead).toHaveBeenCalled();
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
