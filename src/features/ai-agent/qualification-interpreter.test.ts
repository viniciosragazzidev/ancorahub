import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runGateway: vi.fn(), logAiUsage: vi.fn() }));
vi.mock("@/features/ai-gateway/gateway", () => ({ runGateway: mocks.runGateway }));
vi.mock("./ai-usage-log", () => ({ logAiUsage: mocks.logAiUsage }));

import { buildInterpreterMessages, interpretQualificationTurn, INTERPRETER_MAX_ATTEMPTS, INTERPRETER_TIMEOUT_MS } from "./qualification-interpreter";

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
  it("uses the gateway interpreter profile: paid models only, 6 s each, two models at most", async () => {
    mocks.runGateway.mockResolvedValue({ ok: true, value: { memoryUpdates: [{ field: "planType", value: "familiar", confidence: 1 }] }, text: "", model: { provider: "openrouter", model: "google/gemini-3.1-flash-lite" }, attempts: 1 });
    const result = await interpretQualificationTurn(input);
    expect(mocks.runGateway).toHaveBeenCalledWith(expect.objectContaining({ profile: "interpreter", purpose: "qualification_fallback", sensitive: true, timeoutMs: INTERPRETER_TIMEOUT_MS, maxAttempts: INTERPRETER_MAX_ATTEMPTS, conversationId: "c1", sourceMessageId: "m1" }));
    expect(INTERPRETER_TIMEOUT_MS).toBe(6_000);
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
    expect(system.content).toContain("Nome: Ana");
    expect(system.content).toContain("\"memoryUpdates\"");
    expect(last).toEqual({ role: "user", content: "é pra família" });
  });
});
