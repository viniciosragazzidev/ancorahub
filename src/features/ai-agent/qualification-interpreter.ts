import { z } from "zod";

import { MemoryUpdateSchema, type AiMemoryUpdate } from "./ai-response-schema";

/**
 * The LLM interpreter of a qualification turn (purpose "qualification_fallback").
 * It runs inside the customer's turn, so it goes through the AI gateway with the
 * fast "interpreter" profile: two models at most, 6 s each, then the rule engine
 * answers alone. Every attempt is logged by the gateway; giving up is logged with
 * status "fallback" and the reason, so failures do not hide behind a "success".
 */

export const INTERPRETER_TIMEOUT_MS = 6_000;
export const INTERPRETER_MAX_ATTEMPTS = 2;
export const RULE_ENGINE_MODEL = "fallback-rule-engine";

export const interpreterOutputSchema = z.object({
  memoryUpdates: z.array(MemoryUpdateSchema).max(8).default([]),
  confidence: z.number().min(0).max(1).optional(),
});

const OUTPUT_INSTRUCTION = `
FORMATO DE RESPOSTA: responda APENAS com um JSON válido, sem markdown e sem texto fora dele:
{"memoryUpdates": [{"field": "planType", "value": "familiar", "confidence": 1}], "confidence": 0.9}
"memoryUpdates" lista só fatos que o cliente informou; vazio quando não houver nenhum.`;

export function buildInterpreterMessages(input: {
  prompt: string;
  memoryContext?: string;
  leadName?: string | null;
  leadType?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  const system = [
    input.prompt,
    input.memoryContext ?? "",
    `Contexto do Lead: Nome: ${input.leadName || "Não informado"}, Tipo: ${input.leadType || "Não definido"}.`,
    OUTPUT_INSTRUCTION,
  ].filter(Boolean).join("\n\n");
  return [
    { role: "system" as const, content: system },
    ...input.messages.slice(-12).map((message) => ({ role: message.role, content: message.content })),
  ];
}

export type InterpreterResult = {
  ok: boolean;
  memoryUpdates: AiMemoryUpdate[];
  modelUsed: string;
  latencyMs: number;
  attempts: number;
  error?: string;
};

export async function interpretQualificationTurn(input: {
  tenantId: string;
  conversationId: string;
  leadId?: string | null;
  sourceMessageId?: string | null;
  prompt: string;
  memoryContext?: string;
  leadName?: string | null;
  leadType?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<InterpreterResult> {
  const startedAt = Date.now();
  const [{ runGateway }, { logAiUsage }] = await Promise.all([
    import("@/features/ai-gateway/gateway"),
    import("./ai-usage-log"),
  ]);
  let result: Awaited<ReturnType<typeof runGateway<z.infer<typeof interpreterOutputSchema>>>> | null = null;
  let thrown: string | undefined;
  try {
    result = await runGateway({
      profile: "interpreter",
      purpose: "qualification_fallback",
      tenantId: input.tenantId,
      // One limiter bucket per conversation: the tenant-wide traffic must not be throttled.
      userId: `conversation:${input.conversationId}`,
      conversationId: input.conversationId,
      leadId: input.leadId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      // The customer's conversation: only paid models that do not train on it (LGPD art. 11).
      sensitive: true,
      temperature: 0,
      maxTokens: 300,
      timeoutMs: INTERPRETER_TIMEOUT_MS,
      maxAttempts: INTERPRETER_MAX_ATTEMPTS,
      schema: interpreterOutputSchema,
      messages: buildInterpreterMessages(input),
    });
  } catch (error) {
    thrown = error instanceof Error ? error.message : "unknown_error";
  }

  const latencyMs = Date.now() - startedAt;
  if (result?.ok) {
    return { ok: true, memoryUpdates: result.value.memoryUpdates, modelUsed: `${result.model.provider}/${result.model.model}`, latencyMs, attempts: result.attempts };
  }
  const error = thrown ?? (result ? [result.reason, result.lastError].filter(Boolean).join(": ") : "unknown_error");
  await logAiUsage({
    tenantId: input.tenantId,
    purpose: "qualification_fallback",
    model: RULE_ENGINE_MODEL,
    startedAt,
    success: false,
    status: "fallback",
    error,
    conversationId: input.conversationId,
    leadId: input.leadId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
  });
  return { ok: false, memoryUpdates: [], modelUsed: RULE_ENGINE_MODEL, latencyMs, attempts: result?.attempts ?? 0, error };
}
