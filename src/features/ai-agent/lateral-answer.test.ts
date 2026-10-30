import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runGateway: vi.fn(),
  logAiUsage: vi.fn(),
  buildSituationalPromptSection: vi.fn(({ variables }: { variables: { cliente_nome: string } }) => `Cliente: ${variables.cliente_nome}`),
}));
vi.mock("@/features/ai-gateway/gateway", () => ({ runGateway: mocks.runGateway }));
vi.mock("./ai-usage-log", () => ({ logAiUsage: mocks.logAiUsage }));
vi.mock("@/features/ai-qualification/tenant-settings-service", () => ({ getQualificationTenantSettings: vi.fn(async () => null) }));
vi.mock("@/features/ai-qualification/playbooks-storage", () => ({ getTenantPlaybooks: vi.fn(async () => []) }));
vi.mock("@/features/ai-qualification/situational-response-engine", () => ({ buildSituationalPromptSection: mocks.buildSituationalPromptSection }));

import { buildLateralAnswerPrompt, generateLateralAnswer, isCustomerQuestion, sanitizeLateralAnswer } from "./lateral-answer";

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

describe("generateLateralAnswer through the AI gateway", () => {
  beforeEach(() => { mocks.runGateway.mockReset(); mocks.logAiUsage.mockReset(); });
  const input = { tenantId: "t1", question: "vocês atendem em Nova Iguaçu?", conversationId: "c1", leadId: "l1" };

  it("uses the fast interpreter profile with paid models only and returns the sanitized answer", async () => {
    mocks.runGateway.mockResolvedValue({ ok: true, value: { answer: "Sim, atendemos toda a Baixada. Qual sua idade?" }, text: "", model: { provider: "openrouter", model: "google/gemini-3.1-flash-lite" }, attempts: 1 });
    expect(await generateLateralAnswer(input)).toBe("Sim, atendemos toda a Baixada.");
    expect(mocks.runGateway).toHaveBeenCalledWith(expect.objectContaining({ profile: "interpreter", purpose: "lateral_answer", sensitive: true, maxAttempts: 2, conversationId: "c1" }));
    expect(mocks.logAiUsage).not.toHaveBeenCalled();
  });

  it("redacts the lead name and personal details before the provider call", async () => {
    mocks.runGateway.mockResolvedValue({ ok: true, value: { answer: "Sim, atendemos em Campinas." }, text: "", model: { provider: "openrouter", model: "mock" }, attempts: 1 });
    await generateLateralAnswer({
      ...input,
      customerFirstName: "João da Silva",
      question: "João, meu CPF é 12345678901. Moro na Rua das Flores, 123, Centro, Campinas, CEP 13050-123. Meu e-mail é joao@example.com.",
    });
    const serialized = JSON.stringify(mocks.runGateway.mock.calls[0]?.[0]?.messages);
    expect(serialized).toContain("[NOME]");
    expect(serialized).toContain("[CPF]");
    expect(serialized).toContain("[ENDEREÇO]");
    expect(serialized).toContain("[CEP]");
    expect(serialized).toContain("[E-MAIL]");
    expect(serialized).not.toMatch(/João|12345678901|Rua das Flores|13050-123|joao@example\.com/i);
  });

  it("logs status fallback with the reason when every model fails (21/10: OpenRouter 401)", async () => {
    mocks.runGateway.mockResolvedValue({ ok: false, reason: "all_failed", attempts: 2, lastError: "openrouter/anthropic/claude-haiku-5.5: HTTP 401 User not found." });
    expect(await generateLateralAnswer(input)).toBeNull();
    expect(mocks.logAiUsage).toHaveBeenCalledWith(expect.objectContaining({ purpose: "lateral_answer", status: "fallback", success: false, error: expect.stringContaining("HTTP 401") }));
  });
});
