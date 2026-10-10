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
import { defaultChains, resolveChain } from "./profiles";

const env = { ...process.env };
beforeEach(() => { settings.values.clear(); usage.log.mockReset(); process.env = { ...env, GROQ_API_KEY: "g", OPENROUTER_API_KEY: "o", GOOGLE_API_KEY: "", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "" }; });
afterEach(() => { vi.unstubAllGlobals(); process.env = env; });

describe("profiles", () => {
  it("chains free models first and skips providers without a key", () => {
    const chain = resolveChain("chat-smart", { env: { AI_GROQ_SMART_MODEL: "modelo-grande" }, hasKey: (provider) => provider === "groq" || provider === "openrouter" });
    expect(chain[0]).toEqual({ provider: "groq", model: "modelo-grande" });
    expect(chain.map((ref) => ref.provider)).toEqual(["groq", "openrouter"]);
  });

  it("uses a valid super-admin override and ignores an invalid one", () => {
    const hasKey = () => true;
    expect(resolveChain("chat-fast", { env: {}, overrides: { "chat-fast": [{ provider: "google", model: "gemini-x" }] }, hasKey })).toEqual([{ provider: "google", model: "gemini-x" }]);
    expect(resolveChain("chat-fast", { env: {}, overrides: { "chat-fast": [{ provider: "nope", model: "x" }] }, hasKey })[0]).toEqual(defaultChains({})["chat-fast"][0]);
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
    expect(blocks.find((block) => block.type === "button")).toMatchObject({ href: "https://wa.me/5521999998888?text=Oi%20Maria%2C%20tudo%20bem%3F" });
  });

  it("tell the model the rules and the allowed action codes", () => {
    const [system] = buildMessages(AGENT_REGISTRY.cotacao, "ctx", "quanto custa?");
    expect(system!.content).toContain("Nunca informe preço");
    expect(system!.content).toContain("open.quote");
  });
});

describe("runGateway", () => {
  const schema = z.object({ text: z.string() });
  const call = () => runGateway({ profile: "chat-fast", purpose: "test", tenantId: "t", userId: `u-${Math.random()}`, messages: [{ role: "user", content: "fone 21 99999-8888" }], schema });

  it("falls back to the next model when one fails and logs the real provider", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "```json\n{\"text\":\"ok\"}\n```" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await call();
    expect(result).toMatchObject({ ok: true, value: { text: "ok" }, attempts: 2 });
    // Free tier: personal data masked before leaving.
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).messages[0].content).toContain("[telefone]");
    expect(usage.log).toHaveBeenCalledWith(expect.objectContaining({ success: true, model: expect.stringMatching(/^groq\//) }));
  });

  it("never sends sensitive context to a free-tier provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await runGateway({ profile: "chat-smart", purpose: "test", tenantId: "t", userId: "sensitive", messages: [{ role: "user", content: "x" }], schema, sensitive: true });
    expect(result).toMatchObject({ ok: false, reason: "no_provider" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(AGENT_REGISTRY.lead.sensitive).toBe(true);
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
