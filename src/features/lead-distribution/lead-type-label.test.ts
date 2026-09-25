import { describe, expect, it } from "vitest";
import { formatLeadTypeLabel, readSourcePlanType } from "./lead-type-label";

describe("formatLeadTypeLabel", () => {
  it("reads the upper-case values leads.tipo actually stores", () => {
    expect(formatLeadTypeLabel("PME")).toBe("PME");
    expect(formatLeadTypeLabel("PJ")).toBe("Empresarial");
    expect(formatLeadTypeLabel("PF")).toBe("Pessoa Física");
    expect(formatLeadTypeLabel("pme")).toBe("PME");
  });

  it("shows the Meta form's CNPJ type and treats it as a company plan, even on leads stored as PF", () => {
    expect(formatLeadTypeLabel("PF", { tipoCnpj: "mei" })).toBe("PME · MEI");
    expect(formatLeadTypeLabel("PME", { tipoCnpj: "ltda" })).toBe("PME · LTDA");
    expect(formatLeadTypeLabel("PF", { tipoCnpj: "outros" })).toBe("PME · Outro CNPJ");
    expect(formatLeadTypeLabel("PF", { tipoCnpj: "Sociedade Simples" })).toBe("PME · Sociedade Simples");
  });

  it("ignores missing or malformed metadata", () => {
    expect(formatLeadTypeLabel("PF", null)).toBe("Pessoa Física");
    expect(formatLeadTypeLabel(null, { tipoCnpj: "  " })).toBe("Pessoa Física");
    expect(formatLeadTypeLabel("PF", ["mei"])).toBe("Pessoa Física");
  });
});

describe("readSourcePlanType", () => {
  it("returns the captured plan type only when it is a non-empty string", () => {
    expect(readSourcePlanType({ tipoPlano: "Plano Familiar" })).toBe("Plano Familiar");
    expect(readSourcePlanType({ tipoPlano: null })).toBeNull();
    expect(readSourcePlanType(undefined)).toBeNull();
  });
});
