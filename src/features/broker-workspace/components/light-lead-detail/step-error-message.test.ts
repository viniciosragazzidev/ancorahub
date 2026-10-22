import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { stepErrorMessage } from "./use-lead-detail";

const generic = "Não deu para mudar a etapa agora. Tente de novo em instantes.";

describe("stepErrorMessage", () => {
  it("shows the reasons the broker can act on", () => {
    expect(stepErrorMessage("Inicie o atendimento antes de alterar o status deste lead.")).toBe("Inicie o atendimento antes de alterar o status deste lead.");
    expect(stepErrorMessage("Transição inválida: Novo → Convertido.")).toBe("Transição inválida: Novo → Convertido.");
  });

  it("never shows the IA diagnosis of the regression guard", () => {
    const message = stepErrorMessage("PROTECAO_REGRESSAO_IA: A IA identificou este atendimento como uma possível venda (Sinais de compra detectados pela IA: \"quero fechar\").");
    expect(message).toBe("Esse lead parecia perto de fechar. Conte em poucas palavras por que ele voltou de etapa, com pelo menos 15 caracteres.");
    expect(message).not.toContain("quero fechar");
  });

  it("keeps the generic message for conflicts and unknown failures", () => {
    expect(stepErrorMessage("CONFLICT_VERSION")).toBe(generic);
    expect(stepErrorMessage("duplicate key value violates unique constraint")).toBe(generic);
    expect(stepErrorMessage(undefined)).toBe(generic);
  });
});
