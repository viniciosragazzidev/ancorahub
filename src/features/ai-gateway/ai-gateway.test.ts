import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
const settings = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async (key: string) => settings.values.get(key) ?? null) }));
const usage = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@/features/ai-agent/ai-usage-log", () => ({ logAiUsage: usage.log }));

import { AGENT_REGISTRY, assistantReplySchema, buildMessages, replyToBlocks } from "./agents";
import { extractJson, runGateway } from "./gateway";
import { maskPersonalData, shortName } from "./privacy";
import { defaultChains, isFreeTier, resolveChain } from "./profiles";

const env = { ...process.env };
beforeEach(() => { settings.values.clear(); usage.log.mockReset(); process.env = { ...env, GROQ_API_KEY: "g", OPENROUTER_API_KEY: "o", GOOGLE_API_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" }; });
afterEach(() => { vi.unstubAllGlobals(); process.env = env; });

describe("profiles", () => {
  it("chains the paid OpenRouter models first and skips providers without a key", () => {
    const chain = resolveChain("chat-smart", { env: { AI_GROQ_SMART_MODEL: "modelo-grande" }, hasKey: (provider) => provider === "groq" || provider === "openrouter" });
    expect(chain.slice(0, 2)).toEqual([{ provider: "openrouter", model: "anthropic/claude-haiku-5.5" }, { provider: "openrouter", model: "openai/gpt-oss-120b" }]);
    expect(chain).toContainEqual({ provider: "groq", model: "modelo-grande" });
    expect(chain.every((ref) => ref.provider === "groq" || ref.provider === "openrouter")).toBe(true);
  });

  it("knows which models are free tier (OpenRouter only with :free)", () => {
    expect(isFreeTier({ provider: "openrouter", model: "anthropic/claude-haiku-5.5" })).toBe(false);
    expect(isFreeTier({ provider: "openrouter", model: "google/gemma-4-31b-it:free" })).toBe(true);
    expect(isFreeTier({ provider: "groq", model: "openai/gpt-oss-20b" })).toBe(true);
    expect(isFreeTier({ provider: "anthropic", model: "claude-haiku-5-5" })).toBe(false);
  });

  it("uses a valid super-admin override and ignores an invalid one", () => {
    const hasKey = () => true;
    expect(resolveChain("chat-fast", { env: {}, overrides: { "chat-fast": [{ provider: "google", model: "gemini-x" }] }, hasKey })).toEqual([{ provider: "google", model: "gemini-x" }]);
    expect(resolveChain("chat-fast", { env: {}, overrides: { "chat-fast": [{ provider: "nope", model: "x" }] }, hasKey })[0]).toEqual(defaultChains({})["chat-fast"][0]);
  });
});

describe("default models", () => {
  // 2026-10-12: the Llama defaults were retired by the providers (HTTP 404 on every call).
  it("uses live models and never falls back to a retired one", () => {
    const chains = defaultChains({ GROQ_MODEL: "llama-3.3-70b-versatile" });
    const models = Object.values(chains).flat().map((ref) => ref.model);
    expect(chains["chat-fast"]).toContainEqual({ provider: "groq", model: "openai/gpt-oss-20b" });
    expect(chains["chat-smart"]).toContainEqual({ provider: "groq", model: "openai/gpt-oss-120b" });
    expect(models.some((model) => /llama-3\.(1|3)/.test(model))).toBe(false);
  });
});

describe("privacy", () => {
  it("masks phones, e-mails and CPFs and shortens names", () => {
    expect(maskPersonalData("Ligue (21) 99999-8888 ou maria@x.com, CPF 123.456.789-00")).toBe("Ligue [telefone] ou [e-mail], CPF [cpf]");
    expect(maskPersonalData("meu fone 98765-4321.")).toBe("meu fone [telefone].");
    expect(maskPersonalData("protocolo 2026-10-10")).toBe("protocolo 2026-10-10");
    expect(shortName("Maria Souza Lima")).toBe("Maria L.");
  });
});

describe("agents", () => {
  it("keep only the actions the agent is allowed to suggest", () => {
    const reply = assistantReplySchema.parse({
      text: "Comece pela Maria.",
      suggestions: [{ label: "Chamar a Maria", action: "lead.registerContact" }, { label: "Pausar", action: "duty.pause" }],
      draftMessage: "Oi Maria, tudo bem?",
    });
    const blocks = replyToBlocks(AGENT_REGISTRY.leads, reply, { leadId: "l1", whatsappUrl: "https://wa.me/5521999998888" }, "1");
    const question = blocks.find((block) => block.type === "question");
    expect(question && question.type === "question" ? question.choices.map((choice) => choice.id) : []).toEqual(["ai-0-lead.registerContact"]);
    expect(blocks.find((block) => block.type === "button")).toMatchObject({ href: "https://web.whatsapp.com/send?phone=5521999998888&text=Oi%20Maria%2C%20tudo%20bem%3F" });
  });

  it("tell the model the rules and the allowed action codes", () => {
    const [system] = buildMessages(AGENT_REGISTRY.cotacao, "ctx", "quanto custa?");
    expect(system!.content).toContain("Nunca informe preço");
    expect(system!.content).toContain("open.quote");
  });
});

describe("runGateway", () => {
  const schema = z.object({ text: z.string() });
  // Only the Groq key: the free tier path (masking, fallback between its models).
  const freeOnly = () => { process.env = { ...env, GROQ_API_KEY: "g", OPENROUTER_API_KEY: "", GOOGLE_API_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" }; };
  const call = () => runGateway({ profile: "chat-fast", purpose: "test", tenantId: "t", userId: `u-${Math.random()}`, messages: [{ role: "user", content: "fone 21 99999-8888" }], schema });

  it("falls back to the next model when one fails and logs the real provider", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "```json\n{\"text\":\"ok\"}\n```" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    freeOnly();
    const result = await call();
    expect(result).toMatchObject({ ok: true, value: { text: "ok" }, attempts: 2 });
    // Free tier: personal data masked before leaving.
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).messages[0].content).toContain("[telefone]");
    expect(usage.log).toHaveBeenCalledWith(expect.objectContaining({ success: true, model: expect.stringMatching(/^groq\//) }));
  });

  it("never sends sensitive context to a free-tier provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    freeOnly();
    const result = await runGateway({ profile: "chat-smart", purpose: "test", tenantId: "t", userId: "sensitive", messages: [{ role: "user", content: "x" }], schema, sensitive: true });
    expect(result).toMatchObject({ ok: false, reason: "no_provider" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(AGENT_REGISTRY.lead.sensitive).toBe(true);
    expect(AGENT_REGISTRY.ancora.sensitive).toBe(true);
  });

  it("reports no provider when no key exists", async () => {
    process.env = { ...env, GROQ_API_KEY: "", OPENROUTER_API_KEY: "", GOOGLE_API_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" };
    expect(await call()).toMatchObject({ ok: false, reason: "no_provider" });
  });

  it("extracts the JSON object from wrapped text", () => {
    expect(extractJson("Aqui: {\"a\":1} fim")).toEqual({ a: 1 });
    expect(extractJson("sem json")).toBeNull();
  });
});

describe("runGateway with the paid router", () => {
  it("sends sensitive context only to a paid OpenRouter model, unmasked", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{\"text\":\"ok\"}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await runGateway({ profile: "chat-smart", purpose: "test", tenantId: "t", userId: "paid", messages: [{ role: "user", content: "fone 21 99999-8888" }], schema: z.object({ text: z.string() }), sensitive: true });
    expect(result).toMatchObject({ ok: true, model: { provider: "openrouter", model: "anthropic/claude-haiku-5.5" } });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).messages[0].content).toBe("fone 21 99999-8888");
    // LGPD: the paid route only goes to providers that neither keep nor train on the data.
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).provider).toEqual({ data_collection: "deny" });
  });
});

describe("interpreter profile (qualification interpreter and lateral answer)", () => {
  it("tries Gemini Flash Lite and then Claude Haiku, both paid on OpenRouter, and is configurable by env", () => {
    const chain = resolveChain("interpreter", { env: {}, hasKey: (provider) => provider === "openrouter", allow: (ref) => !isFreeTier(ref) });
    expect(chain).toEqual([
      { provider: "openrouter", model: "google/gemini-3.1-flash-lite" },
      { provider: "openrouter", model: "anthropic/claude-haiku-5.5" },
    ]);
    expect(resolveChain("interpreter", { env: { AI_INTERPRETER_MODEL: "x/a", AI_INTERPRETER_FALLBACK_MODEL: "x/b" }, hasKey: (provider) => provider === "openrouter" }).slice(0, 2).map((ref) => ref.model)).toEqual(["x/a", "x/b"]);
    expect(defaultChains({}).interpreter.some((ref) => /llama/.test(ref.model))).toBe(false);
  });

  it("stops after maxAttempts and reports the last error (with timeout) so the caller can log the fallback", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{\"error\":{\"message\":\"User not found.\",\"code\":401}}", { status: 401 }))
      .mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "TimeoutError" }))
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "{\"text\":\"ok\"}" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    process.env = { ...env, OPENROUTER_API_KEY: "o", ANTHROPIC_API_KEY: "a", GROQ_API_KEY: "", GOOGLE_API_KEY: "", OPENAI_API_KEY: "" };
    const result = await runGateway({ profile: "interpreter", purpose: "qualification_fallback", tenantId: "t", userId: "conversation:c1", conversationId: "c1", sourceMessageId: "m1", messages: [{ role: "user", content: "x" }], schema: z.object({ text: z.string() }), sensitive: true, timeoutMs: 6_000, maxAttempts: 2 });
    // Anthropic direct first (Console credit, 24/10), then Gemini Flash Lite on OpenRouter.
    expect(result).toMatchObject({ ok: false, reason: "all_failed", attempts: 2, lastError: "openrouter/google/gemini-3.1-flash-lite: timeout 6000ms" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(usage.log).toHaveBeenCalledWith(expect.objectContaining({ success: false, purpose: "qualification_fallback", conversationId: "c1", sourceMessageId: "m1", error: expect.stringContaining("HTTP 401") }));
  });
});

describe("Anthropic direct first when its key exists (Console credit, 24/10)", () => {
  it("puts Claude Haiku direct ahead of OpenRouter in every profile", () => {
    for (const profile of ["interpreter", "chat-fast", "chat-smart", "json-structured", "long-context"] as const) {
      expect(resolveChain(profile, { env: {}, hasKey: () => true })[0]).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
    }
  });
});
