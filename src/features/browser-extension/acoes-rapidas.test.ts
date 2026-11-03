import { beforeEach, describe, expect, it, vi } from "vitest";

// Dados falsos: nenhum telefone, CPF ou nome real.
const state = vi.hoisted(() => ({
  contexto: { userId: "corretor-1", tenantId: "empresa-1", role: "broker", branchId: "unidade-1" },
  sessao: { id: "sessao-1", userId: "corretor-1", tenantId: "empresa-1", deviceId: "aparelho-1234-5678", extensionVersion: "0.2.0", permissions: ["CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"] },
  leadDoCorretor: { id: "lead-do-corretor", version: 3 } as { id: string; version: number } | null,
  auditorias: [] as Array<{ acao: string; detalhe: Record<string, unknown> }>,
  insercoes: [] as string[],
  criarTarefa: vi.fn(async () => ({ taskId: "tarefa-1" })),
  criarLembrete: vi.fn(async () => ({ taskId: "lembrete-1", dueAt: new Date("2026-11-04T12:00:00.000Z") })),
  mudarStatus: vi.fn(async () => ({ success: true })),
  contexto_sugestao: vi.fn(async () => ({ nome: "Cliente Exemplo", etapa: "in_contact", qualificado: false })),
}));

vi.mock("./access", () => ({ requireExtensionAccess: async () => ({ session: state.sessao, context: state.contexto }) }));
vi.mock("./lead-context", () => ({ getLeadForExtension: async (_contexto: unknown, id: string) => (state.leadDoCorretor && id === state.leadDoCorretor.id ? state.leadDoCorretor : null) }));
vi.mock("./audit", () => ({
  recordExtensionAudit: async (acao: string, _sessao: unknown, detalhe: Record<string, unknown>) => { state.auditorias.push({ acao, detalhe }); },
  extensionAuditMetadata: () => ({ source: "extension" }),
}));
vi.mock("@/features/leads/tarefa-servico", () => ({ criarTarefaDoLead: state.criarTarefa }));
vi.mock("@/features/leads/lembrete-servico", () => ({ criarLembreteDoLead: state.criarLembrete }));
vi.mock("@/features/leads/change-lead-status", () => ({ changeLeadStatus: state.mudarStatus }));
vi.mock("./sugestoes", async (importOriginal) => ({ ...(await importOriginal<typeof import("./sugestoes")>()), contextoDaSugestao: state.contexto_sugestao }));
vi.mock("@/shared/db", () => ({
  schema: { leadInteractions: "leadInteractions" },
  getDatabase: () => ({
    transaction: async (fn: (tx: { insert: (tabela: string) => { values: () => Promise<void> } }) => Promise<void>) => fn({
      insert: (tabela: string) => ({ values: async () => { state.insercoes.push(tabela); } }),
    }),
  }),
}));

const pedido = (corpo: unknown) => new Request("https://crm.local/api", { method: "POST", body: JSON.stringify(corpo), headers: { "content-type": "application/json" } });
const params = (leadId: string) => ({ params: Promise.resolve({ leadId }) });

import { POST as tarefa } from "../../app/api/extension/leads/[leadId]/tasks/route";
import { POST as lembrete } from "../../app/api/extension/leads/[leadId]/reminders/route";
import { POST as nota } from "../../app/api/extension/leads/[leadId]/notes/route";
import { PATCH as status } from "../../app/api/extension/leads/[leadId]/status/route";
import { POST as sugestao } from "../../app/api/extension/leads/[leadId]/reply-suggestions/route";

describe("ações rápidas da extensão", () => {
  beforeEach(() => {
    state.auditorias = [];
    state.insercoes = [];
    state.criarTarefa.mockClear();
    state.criarLembrete.mockClear();
    state.mudarStatus.mockClear();
    state.leadDoCorretor = { id: "lead-do-corretor", version: 3 };
  });

  it("tarefa passa pelo serviço do CRM com o contexto do corretor e audita", async () => {
    const resposta = await tarefa(pedido({ title: "Ligar amanhã cedo", expectedVersion: 3 }), params("lead-do-corretor"));
    expect(resposta.status).toBe(200);
    expect(state.criarTarefa).toHaveBeenCalledWith(state.contexto, expect.objectContaining({ leadId: "lead-do-corretor", assigneeIds: [], priority: "normal" }));
    expect(state.auditorias[0]).toMatchObject({ acao: "extension.task.created" });
  });

  it("lead de outro corretor responde 404 e o serviço não é chamado", async () => {
    const resposta = await tarefa(pedido({ title: "Ligar amanhã cedo", expectedVersion: 3 }), params("lead-de-outro"));
    expect(resposta.status).toBe(404);
    expect(state.criarTarefa).not.toHaveBeenCalled();
  });

  it("versão diferente responde 409 antes de gravar", async () => {
    const resposta = await tarefa(pedido({ title: "Ligar amanhã cedo", expectedVersion: 2 }), params("lead-do-corretor"));
    expect(resposta.status).toBe(409);
    expect(state.criarTarefa).not.toHaveBeenCalled();
  });

  it("lembrete passa pelo serviço com o preset e devolve o prazo", async () => {
    const resposta = await lembrete(pedido({ when: "tomorrow", expectedVersion: 3 }), params("lead-do-corretor"));
    const corpo = await resposta.json();
    expect(state.criarLembrete).toHaveBeenCalledWith(state.contexto, expect.objectContaining({ when: "tomorrow" }));
    expect(corpo.dueAt).toBe("2026-11-04T12:00:00.000Z");
    expect(state.auditorias[0]).toMatchObject({ acao: "extension.reminder.created" });
  });

  it("nota grava a interação e a auditoria na mesma transação", async () => {
    const resposta = await nota(pedido({ conteudo: "Cliente pediu retorno na semana que vem.", expectedVersion: 3 }), params("lead-do-corretor"));
    expect(resposta.status).toBe(200);
    expect(state.insercoes).toEqual(["leadInteractions"]);
    expect(state.auditorias[0]).toMatchObject({ acao: "extension.note.created" });
  });

  it("nota vazia é recusada (400) sem gravar", async () => {
    const resposta = await nota(pedido({ conteudo: "   ", expectedVersion: 3 }), params("lead-do-corretor"));
    expect(resposta.status).toBe(400);
    expect(state.insercoes).toEqual([]);
  });

  it("mudança de etapa encaminha o motivo de perda ao serviço (motivo obrigatório é do serviço)", async () => {
    const resposta = await status(new Request("https://crm.local/api", { method: "PATCH", body: JSON.stringify({ statusId: "lost", expectedVersion: 3, motivoPerda: "Sem retorno do cliente" }) }), params("lead-do-corretor"));
    expect(resposta.status).toBe(200);
    expect(state.mudarStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: "lost", motivoPerda: "Sem retorno do cliente" }), state.contexto, undefined, expect.anything());
  });

  it("conflito de versão dentro do serviço vira 409 para a gaveta recarregar", async () => {
    state.mudarStatus.mockRejectedValueOnce(new Error("CONFLICT_VERSION"));
    const resposta = await status(new Request("https://crm.local/api", { method: "PATCH", body: JSON.stringify({ statusId: "in_contact", expectedVersion: 3 }) }), params("lead-do-corretor"));
    expect(resposta.status).toBe(409);
  });

  it("sugestão é só texto: não grava nada no banco, só a auditoria", async () => {
    const resposta = await sugestao(pedido({ goal: "ASK_MISSING_FIELD", expectedLeadVersion: 3 }), params("lead-do-corretor"));
    const corpo = await resposta.json();
    expect(corpo.suggestions.length).toBeGreaterThan(0);
    expect(corpo.aiUsed).toBe(false);
    expect(state.insercoes).toEqual([]);
    expect(state.criarTarefa).not.toHaveBeenCalled();
    expect(state.auditorias[0]).toMatchObject({ acao: "extension.reply.suggested" });
  });
});
