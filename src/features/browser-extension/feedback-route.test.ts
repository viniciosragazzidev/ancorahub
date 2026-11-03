import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mudarStatus: vi.fn(async () => ({ ok: true })),
  transaction: vi.fn(async (trabalho: (tx: unknown) => Promise<void>) => trabalho({
    insert: () => ({ values: async () => undefined }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  })),
}));

vi.mock("@/features/browser-extension/access", () => ({
  requireExtensionAccess: async () => ({
    session: { id: "sessao-a", userId: "corretor-1", tenantId: "empresa-1", deviceId: "aparelho-aaaa-1111", extensionVersion: "0.2.0", permissions: ["REGISTER_FEEDBACK", "CHANGE_STATUS", "CREATE_TASK"] },
    context: { userId: "corretor-1", tenantId: "empresa-1", role: "broker", branchId: "unidade-1" },
  }),
}));
vi.mock("@/features/browser-extension/lead-context", () => ({ getLeadForExtension: async () => ({ id: "lead-1", version: 3, corretorId: "corretor-1" }) }));
vi.mock("@/features/browser-extension/audit", () => ({ extensionAuditMetadata: () => ({ source: "extension" }), recordExtensionAudit: vi.fn(async () => undefined) }));
vi.mock("@/features/leads/change-lead-status", () => ({ changeLeadStatus: state.mudarStatus }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ transaction: state.transaction }) }));

import { POST } from "../../app/api/extension/leads/[leadId]/feedback/route";

const pedido = (corpo: Record<string, unknown>) => new Request("https://crm.test/api/extension/leads/lead-1/feedback", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ outcome: "INTERESTED", expectedVersion: 3, note: "Quer cotação", ...corpo }),
});
const chamar = (corpo: Record<string, unknown>) => POST(pedido(corpo), { params: Promise.resolve({ leadId: "lead-1" }) });

beforeEach(() => {
  state.mudarStatus.mockClear();
  state.mudarStatus.mockResolvedValue({ ok: true });
  state.transaction.mockClear();
});

describe("feedback: status antes da nota e da tarefa (F2)", () => {
  it("muda o status antes de gravar a nota, e leva o motivo de perda", async () => {
    const resposta = await chamar({ statusId: "lost", motivoPerda: "preco" });
    expect(resposta.status).toBe(200);
    expect(state.mudarStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: "lost", motivoPerda: "preco" }), expect.anything(), undefined, expect.anything());
    expect(state.mudarStatus.mock.invocationCallOrder[0]).toBeLessThan(state.transaction.mock.invocationCallOrder[0]);
  });

  it("status recusado pelo serviço (ex.: perda sem motivo): nem nota nem tarefa são gravadas", async () => {
    state.mudarStatus.mockRejectedValueOnce(new Error("É obrigatório informar um motivo de perda válido para marcar o lead como perdido."));
    const resposta = await chamar({ statusId: "lost", nextAction: "Ligar amanhã" });
    expect(resposta.status).toBe(400);
    expect(state.transaction).not.toHaveBeenCalled();
  });

  it("conflito de versão no status vira 409, como na rota de status", async () => {
    state.mudarStatus.mockRejectedValueOnce(new Error("CONFLICT_VERSION"));
    const resposta = await chamar({ statusId: "qualified" });
    expect(resposta.status).toBe(409);
    expect((await resposta.json()).error).toBe("CONFLICT");
    expect(state.transaction).not.toHaveBeenCalled();
  });

  it("sem status, só grava a nota e a tarefa", async () => {
    const resposta = await chamar({ nextAction: "Ligar" });
    expect(resposta.status).toBe(200);
    expect(state.mudarStatus).not.toHaveBeenCalled();
    expect(state.transaction).toHaveBeenCalledTimes(1);
  });
});
