import { describe, expect, it } from "vitest";

import { resolveFunnelBranchScope } from "./funnel-scope";

describe("escopo do funil de qualificação", () => {
  it("usa a unidade autorizada selecionada pelo diretor ou todas quando não há seleção", () => {
    expect(resolveFunnelBranchScope({ role: "director", branchId: null }, "branch-permitida")).toBe("branch-permitida");
    expect(resolveFunnelBranchScope({ role: "director", branchId: null }, null)).toBeNull();
  });

  it("mantém o gestor na unidade da sessão, mesmo se receber outro id", () => {
    expect(resolveFunnelBranchScope({ role: "manager", branchId: "branch-da-sessao" }, "branch-fora-do-escopo")).toBe("branch-da-sessao");
  });

  it("recusa gestor sem unidade", () => {
    expect(() => resolveFunnelBranchScope({ role: "manager", branchId: null }, null)).toThrow("Funil disponível só para a unidade do gestor.");
  });
});
