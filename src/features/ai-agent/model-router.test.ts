import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiRouter, DEFAULT_GROQ_MODEL, DEFAULT_OPENROUTER_MODEL } from "./model-router";

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), { status, headers: { "Content-Type": "application/json" } });
}

describe("model-router", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_MODEL;
    delete process.env.OPENROUTER_MODEL;
    delete process.env.AI_PROVIDER_ORDER;
  });

  it("returns no providers when no API key is configured", async () => {
    const router = await createAiRouter("tenant-test");
    expect(router.providers).toEqual([]);
  });

  it("tries Groq first by default and falls back to OpenRouter when Groq fails", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    process.env.OPENROUTER_API_KEY = "openrouter-key";

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(errorResponse(402, "insufficient credits"))
      .mockResolvedValueOnce(okJson({ choices: [{ message: { content: "ok" } }] }));

    const router = await createAiRouter("tenant-test");
    expect(router.providers).toEqual(["groq", "openrouter"]);

    const result = await router.call({ messages: [{ role: "user", content: "Olá" }] });
    expect(result.provider).toBe("openrouter");
    expect(result.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Groq tentado primeiro
    const groqCall = fetchMock.mock.calls[0];
    expect(String(groqCall[0])).toContain("api.groq.com");
    expect(JSON.parse(String(groqCall[1]?.body)).model).toBe(DEFAULT_GROQ_MODEL);

    // OpenRouter assume depois
    const openrouterCall = fetchMock.mock.calls[1];
    expect(String(openrouterCall[0])).toContain("openrouter.ai");
    expect(JSON.parse(String(openrouterCall[1]?.body)).model).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("honors AI_PROVIDER_ORDER when reversing the preference", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    process.env.AI_PROVIDER_ORDER = "openrouter,groq";

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(okJson({ choices: [{ message: { content: "ok" } }] }));

    const router = await createAiRouter("tenant-test");
    expect(router.providers).toEqual(["openrouter", "groq"]);

    const result = await router.call({ messages: [{ role: "user", content: "Olá" }] });
    expect(result.provider).toBe("openrouter");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("prefers the provider that already responded when asked", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    process.env.OPENROUTER_API_KEY = "openrouter-key";
    process.env.AI_PROVIDER_ORDER = "openrouter,groq";

    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(errorResponse(429, "rate limited"))
      .mockResolvedValueOnce(okJson({ choices: [{ message: { content: "ok" } }] }));

    const router = await createAiRouter("tenant-test");
    const result = await router.call({
      messages: [{ role: "user", content: "Corrija" }],
      prefer: { provider: "groq", model: DEFAULT_GROQ_MODEL },
    });

    // O preferido (groq) é tentado primeiro, falha (429) e o fallback assume.
    expect(result.provider).toBe("openrouter");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.groq.com");
    expect(String(fetchMock.mock.calls[1][0])).toContain("openrouter.ai");
  });

  it("throws a combined error when all providers fail", async () => {
    process.env.GROQ_API_KEY = "groq-key";
    process.env.OPENROUTER_API_KEY = "openrouter-key";

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(errorResponse(402, "insufficient credits"))
      .mockResolvedValueOnce(errorResponse(503, "unavailable"));

    const router = await createAiRouter("tenant-test");
    await expect(router.call({ messages: [{ role: "user", content: "Olá" }] }))
      .rejects.toMatchObject({ status: 503 });
  });
});
