import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runGateway: vi.fn(), logAiUsage: vi.fn() }));
vi.mock("@/features/ai-gateway/gateway", () => ({ runGateway: mocks.runGateway }));
vi.mock("./ai-usage-log", () => ({ logAiUsage: mocks.logAiUsage }));

import { buildInterpreterMessages, interpretQualificationTurn, verifyExtractedFacts, INTERPRETER_MAX_ATTEMPTS, INTERPRETER_TIMEOUT_MS, INTERPRETER_TOTAL_TIMEOUT_MS, MAX_INTERPRETER_TURN_CHARS, MAX_INTERPRETER_TURN_MESSAGES } from "./qualification-interpreter";

const input = {
  tenantId: "t1",
  conversationId: "c1",
  leadId: "l1",
  sourceMessageId: "m1",
  prompt: "Interprete.",
  messages: [{ role: "user" as const, content: "é pra família" }],
};

beforeEach(() => { mocks.runGateway.mockReset(); mocks.logAiUsage.mockReset(); });

describe("qualification interpreter", () => {
  it("uses paid providers only, 6 s each, Haiku retry, and a widened paid fallback chain", async () => {
    mocks.runGateway.mockResolvedValue({ ok: true, value: { memoryUpdates: [{ field: "planType", value: "familiar", confidence: 1 }] }, text: "", model: { provider: "openrouter", model: "google/gemini-3.1-flash-lite" }, attempts: 1 });
    const result = await interpretQualificationTurn(input);
    expect(mocks.runGateway).toHaveBeenCalledWith(expect.objectContaining({ profile: "interpreter", purpose: "qualification_fallback", sensitive: true, timeoutMs: INTERPRETER_TIMEOUT_MS, totalTimeoutMs: INTERPRETER_TOTAL_TIMEOUT_MS, maxTokens: 1_000, maxAttempts: INTERPRETER_MAX_ATTEMPTS, retryAnthropicHaikuOnTransient: true, conversationId: "c1", sourceMessageId: "m1" }));
    expect(INTERPRETER_TIMEOUT_MS).toBe(6_000);
    expect(INTERPRETER_TOTAL_TIMEOUT_MS).toBe(12_000);
    expect(INTERPRETER_MAX_ATTEMPTS).toBe(5);
    expect(result).toMatchObject({ ok: true, modelUsed: "openrouter/google/gemini-3.1-flash-lite", memoryUpdates: [{ field: "planType", value: "familiar" }] });
    // The gateway logs the successful attempt itself.
    expect(mocks.logAiUsage).not.toHaveBeenCalled();
  });

  it("logs the give-up as status fallback with the reason instead of a success", async () => {
    mocks.runGateway.mockResolvedValue({ ok: false, reason: "all_failed", attempts: 2, lastError: "openrouter/anthropic/claude-haiku-5.5: timeout 6000ms" });
    const result = await interpretQualificationTurn(input);
    expect(result).toMatchObject({ ok: false, memoryUpdates: [], modelUsed: "fallback-rule-engine" });
    expect(mocks.logAiUsage).toHaveBeenCalledWith(expect.objectContaining({
      purpose: "qualification_fallback",
      model: "fallback-rule-engine",
      success: false,
      status: "fallback",
      error: "all_failed: openrouter/anthropic/claude-haiku-5.5: timeout 6000ms",
      conversationId: "c1",
      sourceMessageId: "m1",
    }));
  });

  it("fails open when the gateway throws", async () => {
    mocks.runGateway.mockRejectedValue(new Error("boom"));
    const result = await interpretQualificationTurn(input);
    expect(result.ok).toBe(false);
    expect(mocks.logAiUsage).toHaveBeenCalledWith(expect.objectContaining({ status: "fallback", error: "boom" }));
  });

  it("asks for JSON memory updates only and keeps the lead context", () => {
    const [system, last] = buildInterpreterMessages({ ...input, memoryContext: "MEMÓRIA", leadName: "Ana", leadType: "PF" });
    expect(system.content).toContain("Interprete.");
    expect(system.content).toContain("MEMÓRIA");
    expect(system.content).toContain("Nome: [NOME]");
    expect(system.content).toContain("\"memoryUpdates\"");
    expect(last).toEqual({ role: "user", content: "é pra família" });
  });

  it("keeps every customer message since the last AI reply even when the burst exceeds twelve bubbles", () => {
    const messages = [
      { role: "assistant" as const, content: "Quantas vidas?" },
      ...Array.from({ length: 14 }, (_, index) => ({ role: "user" as const, content: `resposta ${index + 1}` })),
    ];
    const built = buildInterpreterMessages({ ...input, messages });
    expect(built).toHaveLength(16);
    expect(built[1]).toEqual({ role: "assistant", content: "Quantas vidas?" });
    expect(built.slice(2).map((message) => message.content)).toEqual(Array.from({ length: 14 }, (_, index) => `resposta ${index + 1}`));
  });

  it("caps the unanswered turn at fifty messages and twelve thousand redacted characters", () => {
    const manyMessages = [
      { role: "assistant" as const, content: "Quantas vidas?" },
      ...Array.from({ length: MAX_INTERPRETER_TURN_MESSAGES + 5 }, (_, index) => ({ role: "user" as const, content: `resposta ${index + 1}` })),
    ];
    const boundedMessages = buildInterpreterMessages({ ...input, messages: manyMessages });
    expect(boundedMessages).toHaveLength(1 + 1 + MAX_INTERPRETER_TURN_MESSAGES);
    expect(boundedMessages.slice(2).map((message) => message.content)).toEqual(
      manyMessages.slice(-MAX_INTERPRETER_TURN_MESSAGES).map((message) => message.content),
    );

    const boundedChars = buildInterpreterMessages({
      ...input,
      messages: [
        { role: "assistant", content: "Quantas vidas?" },
        { role: "user", content: "a".repeat(MAX_INTERPRETER_TURN_CHARS) },
        { role: "user", content: "b".repeat(1_000) },
      ],
    });
    const currentTurn = boundedChars.slice(2);
    expect(currentTurn.reduce((total, message) => total + message.content.length, 0)).toBe(MAX_INTERPRETER_TURN_CHARS);
    expect(currentTurn.at(-1)?.content).toBe("b".repeat(1_000));
    expect(currentTurn[0]?.content).toBe("a".repeat(MAX_INTERPRETER_TURN_CHARS - 1_000));
  });

  it("redacts identifiers, address and the lead name throughout fallback provider input", () => {
    const messages = buildInterpreterMessages({
      ...input,
      leadName: "João da Silva",
      prompt: "João da Silva, informe seu CPF 123.456.789-01 e CNPJ 12345678000199.",
      memoryContext: "Rua das Flores, 123, Centro, Campinas. CEP 13050-123.",
      messages: [{ role: "user", content: "JOAO mora em Campinas. Telefone (11) 98765-4321, e-mail joao@example.com." }],
    });
    const serialized = JSON.stringify(messages);
    expect(serialized).toContain("[NOME]");
    expect(serialized).toContain("[CPF]");
    expect(serialized).toContain("[CNPJ]");
    expect(serialized).toContain("[ENDEREÇO]");
    expect(serialized).toContain("[CEP]");
    expect(serialized).toContain("[TELEFONE]");
    expect(serialized).toContain("[E-MAIL]");
    expect(serialized).not.toMatch(/João|JOAO|123\.456\.789-01|12345678000199|98765-4321|joao@example\.com|Rua das Flores|13050-123/i);
  });

  it("redacts the fact-verification provider input", async () => {
    mocks.runGateway.mockResolvedValue({ ok: true, value: { correct: true, corrections: [] }, text: "", model: { provider: "groq", model: "mock" }, attempts: 1 });
    await verifyExtractedFacts({
      tenantId: "t1",
      conversationId: "c1",
      leadId: "l1",
      message: "João, meu CPF é 12345678901. Moro na Avenida Brasil, 45, Centro, Campinas, CEP 13050-123.",
      lastQuestion: "João, qual seu e-mail joao@example.com?",
      leadName: "João da Silva",
      facts: { age: "45" },
    });
    const serialized = JSON.stringify(mocks.runGateway.mock.calls[0]?.[0]?.messages);
    expect(serialized).toContain("[NOME]");
    expect(serialized).toContain("[CPF]");
    expect(serialized).toContain("[ENDEREÇO]");
    expect(serialized).toContain("[CEP]");
    expect(serialized).toContain("[E-MAIL]");
    expect(serialized).not.toMatch(/João|12345678901|Avenida Brasil|13050-123|joao@example\.com/i);
  });
});
