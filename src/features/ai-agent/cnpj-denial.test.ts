import { describe, expect, it } from "vitest";

import { questionVariants } from "@/features/qualification-engine/reply-composer";

import { createEmptyMemory, extractFieldsFromMessage, hasPositiveCnpjEvidence, isCompanyDenial } from "./memory";

const PLAN_QUESTION = "O plano é pra você, pra sua família ou pela empresa (CNPJ)?";

describe("negação de CNPJ ou empresa (28/10)", () => {
  it("reconhece as formas de negar CNPJ, inclusive a mensagem real com 'CNPj'", () => {
    for (const message of ["Não tenho CNPj", "Nao tenho CNPJ", "não tenho cnpj", "sem cnpj", "não sou empresa", "pessoa física"]) {
      expect(isCompanyDenial(message), message).toBe(true);
    }
  });

  it("não lê como negação quando o cliente tem CNPJ, é MEI ou só fala de plano", () => {
    for (const message of ["Tenho CNPJ", "sou MEI", "tenho empresa", "plano empresarial", "nao tenho plano"]) {
      expect(isCompanyDenial(message), message).toBe(false);
    }
  });

  it("'Não tenho CNPj' nunca marca CNPJ positivo", () => {
    expect(hasPositiveCnpjEvidence("Não tenho CNPj")).toBe(false);
    expect(hasPositiveCnpjEvidence("Nao tenho CNPJ")).toBe(false);
  });

  it("'Não tenho CNPj' vira sem CNPJ e não fixa individual nem familiar", () => {
    const memory = extractFieldsFromMessage("Não tenho CNPj", { ...createEmptyMemory(), lastQuestionAsked: PLAN_QUESTION, lastQuestionsAsked: PLAN_QUESTION }, "m1");
    expect(memory.companyHasCnpj?.value).toBe("false");
    expect(memory.planType).toBeUndefined();
  });

  it("'não sou empresa' não vira plano empresarial", () => {
    const memory = extractFieldsFromMessage("não sou empresa", { ...createEmptyMemory(), lastQuestionAsked: PLAN_QUESTION }, "m1");
    expect(memory.planType).toBeUndefined();
    expect(memory.companyHasCnpj?.value).toBe("false");
  });

  it("um plano empresarial lido antes sai quando o cliente nega CNPJ", () => {
    const earlier = { ...createEmptyMemory(), planType: { value: "empresarial", confidence: 1 as const }, collectedFields: ["planType"] };
    const memory = extractFieldsFromMessage("não tenho CNPJ", earlier, "m2");
    expect(memory.planType).toBeUndefined();
    expect(memory.collectedFields).not.toContain("planType");
  });

  it("'pessoa física' segue como plano individual e sem CNPJ", () => {
    const memory = extractFieldsFromMessage("pessoa física", { ...createEmptyMemory(), lastQuestionAsked: PLAN_QUESTION }, "m1");
    expect(memory.planType?.value).toBe("individual");
    expect(memory.companyHasCnpj?.value).toBe("false");
  });

  it("'Tenho CNPJ' e 'sou MEI' continuam empresariais", () => {
    const tenho = extractFieldsFromMessage("Tenho CNPJ", { ...createEmptyMemory(), lastQuestionAsked: PLAN_QUESTION }, "m1");
    expect(tenho.planType?.value).toBe("empresarial");
    expect(tenho.companyHasCnpj?.value).toBe("true");
    const mei = extractFieldsFromMessage("sou MEI", { ...createEmptyMemory(), lastQuestionAsked: PLAN_QUESTION }, "m1");
    expect(mei.planType?.value).toBe("empresarial");
  });

  it("sem CNPJ, a pergunta de plano oferece só individual ou família", () => {
    const memory = { ...createEmptyMemory(), companyHasCnpj: { value: "false", confidence: 1 as const } };
    const variants = questionVariants("planType", memory);
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      expect(variant).not.toMatch(/empresa|\(CNPJ\)/i);
      expect(variant).toMatch(/família|pessoal|você/i);
      expect(variant).not.toMatch(/[—–]/);
    }
  });
});
