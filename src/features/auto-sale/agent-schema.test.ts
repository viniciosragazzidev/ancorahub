import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildAnthropicMessagesRequest } from "@/features/ai-gateway/gateway";

import { agentTurnSchema, cleanModelFacts, normalizeDecision } from "./turn-engine";

describe("formato da decisão do modelo", () => {
  it("vira json_schema para o Claude, com tipos claros em cada campo", () => {
    const request = buildAnthropicMessagesRequest({ model: "claude-haiku-5-5", messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }], maxTokens: 100, schema: agentTurnSchema });
    const schema = (request.output_config as { format: { schema: { properties?: Record<string, { type?: string }> } } }).format.schema;
    expect(Object.keys(schema.properties ?? {})).toEqual(expect.arrayContaining(["intent", "facts", "objection", "nextAction", "messages", "managerReason"]));
    expect(schema.properties?.facts?.type).toBe("object");
    expect(schema.properties?.messages?.type).toBe("array");
  });

  it("aceita resposta um pouco fora do formato em vez de descartar o turno", () => {
    const parsed = normalizeDecision(agentTurnSchema.parse({ intent: "talvez", facts: { city: "Niterói", ages: [34, "x"], budgetCents: null, inventado: 1 }, objection: "outra coisa", nextAction: "quote", messages: ["Oi", "", "a".repeat(700)], managerReason: "nada" }));
    expect(parsed).toMatchObject({ intent: "other", facts: { city: "Niterói" }, objection: null, nextAction: "quote", managerReason: null });
    expect(parsed.messages).toEqual(["Oi", "a".repeat(600)]);
    // Sem campos: valores seguros (perguntar de novo), nunca erro.
    expect(normalizeDecision(agentTurnSchema.parse({}))).toMatchObject({ intent: "other", nextAction: "ask", messages: [], facts: {} });
    expect(cleanModelFacts({ ages: [34, 31], modality: "ADESAO", dueDay: 7 })).toEqual({ ages: [34, 31], modality: "ADESAO" });
  });
});
