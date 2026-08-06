import { afterEach, describe, expect, it, vi } from "vitest";

const { getSystemSetting } = vi.hoisted(() => ({
  getSystemSetting: vi.fn(async (key: string) => key.startsWith("openrouter_model_") ? "anthropic/claude-3.5-sonnet" : null),
}));

vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting }));

import { detectHumanTransferRequest, generateAiResponse } from "./service";

describe("OpenRouter WhatsApp AI integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("falls back from the removed Claude 3.5 slug to the free default model", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ message: "Olá! Como posso ajudar?", shouldTransfer: false, shouldWait: true, detectedIntent: "other", language: "pt-BR" }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }), { status: 200 }));

    const result = await generateAiResponse({
      tenantId: "tenant-test",
      messages: [{ role: "user", content: "Olá" }],
    });

    expect(result.success).toBe(true);
    expect(result.modelUsed).toBe("google/gemma-2-9b-it:free");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).model).toBe("google/gemma-2-9b-it:free");
  });

  it.each(["Atendente", "Falar com atendente", "quero falar com uma pessoa"]) (
    "recognizes a deterministic human handoff request: %s",
    (message) => {
      expect(detectHumanTransferRequest(message)).toBe(true);
    },
  );
});
