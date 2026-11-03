import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ auditar: vi.fn(async () => undefined) }));

vi.mock("@/features/browser-extension/access", () => ({
  requireExtensionAccess: async () => ({
    session: { id: "sessao-a", userId: "corretor-1", tenantId: "empresa-1", deviceId: "aparelho-aaaa-1111", extensionVersion: "0.2.0", permissions: ["VIEW_LEAD", "GENERATE_REPLY"] },
    context: { userId: "corretor-1", tenantId: "empresa-1", role: "broker", branchId: "unidade-1" },
  }),
}));
vi.mock("@/features/browser-extension/audit", () => ({ recordExtensionAudit: state.auditar }));

import { POST as telemetria } from "../../app/api/extension/telemetry/route";
import { POST as feedbackSugestao } from "../../app/api/extension/suggestions/[suggestionId]/feedback/route";

const pedido = (url: string, corpo: unknown) => new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });

beforeEach(() => state.auditar.mockClear());

describe("telemetria com enum fechado de eventos (F4)", () => {
  it("evento fora da lista é recusado e não vira ação de auditoria", async () => {
    const resposta = await telemetria(pedido("https://crm.test/api/extension/telemetry", { event: "lead.nome.cliente-tal" }));
    expect(resposta.status).toBe(400);
    expect(state.auditar).not.toHaveBeenCalled();
  });

  it("evento da lista é auditado com o nome fixo", async () => {
    const resposta = await telemetria(pedido("https://crm.test/api/extension/telemetry", { event: "connect.succeeded", success: true }));
    expect(resposta.status).toBe(200);
    expect(state.auditar).toHaveBeenCalledWith("extension.telemetry.connect.succeeded", expect.anything(), { metadata: { success: true } });
  });
});

describe("feedback de sugestão com suggestionId validado (F5)", () => {
  it("id que não é UUID é recusado e não vai para a auditoria", async () => {
    const resposta = await feedbackSugestao(
      pedido("https://crm.test/api/extension/suggestions/x/feedback", { useful: true }),
      { params: Promise.resolve({ suggestionId: "nao-e-uuid" }) },
    );
    expect(resposta.status).toBe(400);
    expect(state.auditar).not.toHaveBeenCalled();
  });

  it("UUID válido é auditado", async () => {
    const id = "1f2e3d4c-0000-4000-8000-000000000002";
    const resposta = await feedbackSugestao(
      pedido(`https://crm.test/api/extension/suggestions/${id}/feedback`, { useful: false }),
      { params: Promise.resolve({ suggestionId: id }) },
    );
    expect(resposta.status).toBe(200);
    expect(state.auditar).toHaveBeenCalledWith("extension.suggestion.not_useful", expect.anything(), { entityId: id });
  });
});
