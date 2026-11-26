import { describe, expect, it } from "vitest";

import { cnpjDigits, cnpjInputProblem, formatCnpj, isValidCnpj, matchesCompanyQuery, normalizeValidCnpj } from "./cnpj";
import { countCompanyLeads, isOpenLeadStatus, opportunitiesLabel } from "./company-portfolio";

// CNPJ público de exemplo (Banco do Brasil) e um com dígito errado.
const VALID = "00.000.000/0001-91";
const WRONG_DIGIT = "00.000.000/0001-92";

describe("CNPJ", () => {
  it("keeps only digits", () => {
    expect(cnpjDigits(" 12.345.678/0001-95 ")).toBe("12345678000195");
    expect(cnpjDigits(null)).toBe("");
  });

  it("validates check digits", () => {
    expect(isValidCnpj(VALID)).toBe(true);
    expect(isValidCnpj("00000000000191")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj(WRONG_DIGIT)).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
    expect(normalizeValidCnpj(VALID)).toBe("00000000000191");
    expect(normalizeValidCnpj(WRONG_DIGIT)).toBeNull();
  });

  it("explains why a CNPJ is refused before the lookup", () => {
    expect(cnpjInputProblem("")).toBe("Digite o CNPJ da empresa.");
    expect(cnpjInputProblem("1234")).toBe("O CNPJ tem 14 dígitos. Confira o número.");
    expect(cnpjInputProblem(WRONG_DIGIT)).toContain("dígitos verificadores");
    expect(cnpjInputProblem(VALID)).toBeNull();
  });

  it("formats 14 digits and leaves anything else as typed", () => {
    expect(formatCnpj("00000000000191")).toBe(VALID);
    expect(formatCnpj(" 1234 ")).toBe("1234");
    expect(formatCnpj(null)).toBe("");
  });

  it("finds a company by name without accents or by CNPJ with or without punctuation", () => {
    const company = { name: "Padaria São João", legalName: "Pães e Doces Ltda", cnpj: "00000000000191" };
    expect(matchesCompanyQuery(company, "sao joao")).toBe(true);
    expect(matchesCompanyQuery(company, "paes e doces")).toBe(true);
    expect(matchesCompanyQuery(company, "00.000.000/0001")).toBe(true);
    expect(matchesCompanyQuery(company, "000000000001")).toBe(true);
    expect(matchesCompanyQuery(company, "0001-91")).toBe(true);
    expect(matchesCompanyQuery(company, "  ")).toBe(true);
    expect(matchesCompanyQuery(company, "mercado")).toBe(false);
    expect(matchesCompanyQuery({ ...company, cnpj: null }, "0001")).toBe(false);
  });
});

describe("carteira PJ", () => {
  it("counts open and total leads per company", () => {
    const counts = countCompanyLeads([
      { companyId: "a", status: "new" },
      { companyId: "a", status: "negotiation" },
      { companyId: "a", status: "converted" },
      { companyId: "b", status: "lost" },
      { companyId: null, status: "new" },
    ]);
    expect(counts.get("a")).toEqual({ open: 2, total: 3 });
    expect(counts.get("b")).toEqual({ open: 0, total: 1 });
    expect(isOpenLeadStatus("awaiting_reply")).toBe(true);
  });

  it("labels opportunities in short sentences", () => {
    expect(opportunitiesLabel(0, 0)).toBe("Nenhuma");
    expect(opportunitiesLabel(1, 1)).toBe("1 aberta");
    expect(opportunitiesLabel(2, 5)).toBe("2 abertas de 5");
  });
});
