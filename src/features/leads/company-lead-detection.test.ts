import { describe, expect, it } from "vitest";

import { companyEvidence, formAnswerCompanyEvidence, formAnswersCompanyEvidence } from "./company-lead-detection";

describe("company lead detection", () => {
  it.each([
    "Tenho CNPJ sim",
    "é pra minha empresa",
    "Sou MEI",
    "quero um plano empresarial",
    "plano PME pra 4 pessoas",
    "Seria pela empresa",
    "o cnpj é 12.345.678/0001-90",
    "Tenho uma empresa de 5 funcionários",
  ])("sees a company in %s", (text) => {
    expect(companyEvidence(text)).not.toBeNull();
  });

  it.each([
    "Não tenho CNPJ",
    "nao tenho cnpj nao",
    "não é empresarial, é pra mim",
    "sem cnpj",
    "Trabalho numa empresa de ônibus",
    "é só pra mim e minha esposa",
    "meio caro esse plano",
    "",
  ])("does not see a company in %s", (text) => {
    expect(companyEvidence(text)).toBeNull();
  });

  it("reads the ad form answers as question and answer", () => {
    expect(formAnswerCompanyEvidence("Você tem CNPJ?: Sim")).toBe("Você tem CNPJ?: Sim");
    expect(formAnswerCompanyEvidence("Tipo de CNPJ: MEI")).toBe("Tipo de CNPJ: MEI");
    expect(formAnswerCompanyEvidence("Para quem é o plano?: empresa")).toBe("Para quem é o plano?: empresa");
    expect(formAnswerCompanyEvidence("Para quem é o plano?: para minha empresa")).not.toBeNull();
    expect(formAnswerCompanyEvidence("Você tem CNPJ?: Não")).toBeNull();
    expect(formAnswerCompanyEvidence("Você possui empresa?: nao possuo")).toBeNull();
    expect(formAnswerCompanyEvidence("Quantas vidas?: 3")).toBeNull();
    expect(formAnswersCompanyEvidence(["Quantas vidas?: 2", "Possui CNPJ ativo?: sim"])).toBe("Possui CNPJ ativo?: sim");
    expect(formAnswersCompanyEvidence(null)).toBeNull();
  });
});
