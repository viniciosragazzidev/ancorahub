import { describe, expect, it } from "vitest";

import { buildLateralAnswerPrompt, isCustomerQuestion, sanitizeLateralAnswer } from "./lateral-answer";

describe("lateral answer", () => {
  it("recognises the customer's questions, not their answers", () => {
    expect(isCustomerQuestion("Quais planos temos ?")).toBe(true);
    expect(isCustomerQuestion("vocês atendem em Nova Iguaçu")).toBe(true);
    expect(isCustomerQuestion("tem plano com dentista?")).toBe(true);
    for (const answer of ["3", "12,33 38", "Nova Iguaçu", "teste@teste.com", "Oi", "é pra mim e minha esposa"]) {
      expect(isCustomerQuestion(answer)).toBe(false);
    }
  });

  it("keeps two short statements and drops the model's own questions", () => {
    expect(sanitizeLateralAnswer("Trabalhamos com planos individuais, familiares e empresariais. As opções dependem da sua região. Qual o seu e-mail?"))
      .toBe("Trabalhamos com planos individuais, familiares e empresariais. As opções dependem da sua região.");
    expect(sanitizeLateralAnswer("\"Sim, atendemos toda a Baixada Fluminense.\" [SOLICITOU_HUMANO]")).toBe("Sim, atendemos toda a Baixada Fluminense.");
  });

  it("refuses prices, percentages, waiting periods and promises as a whole", () => {
    for (const unsafe of [
      "O plano individual custa a partir de R$ 250,00 por mês.",
      "Fica em torno de 199,90 por pessoa.",
      "Temos 20% de desconto este mês.",
      "A carência é de 30 dias.",
      "Garantimos o menor preço do mercado.",
    ]) expect(sanitizeLateralAnswer(unsafe)).toBeNull();
    expect(sanitizeLateralAnswer("")).toBeNull();
    expect(sanitizeLateralAnswer("Qual a sua cidade?")).toBeNull();
  });

  it("tells the model the limits and the company's own information", () => {
    const prompt = buildLateralAnswerPrompt({ assistantName: "Ana", companyName: "Âncora Saúde", businessContext: "Corretora no RJ.", situational: "ROTEIROS: x", customInstructions: "Seja breve." });
    expect(prompt).toContain("Nunca informe preços");
    expect(prompt).toContain("Não faça perguntas");
    expect(prompt).toContain("Corretora no RJ.");
    expect(prompt).toContain("Seja breve.");
  });
});
