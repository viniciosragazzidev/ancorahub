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

/**
 * What the customer meant (qualification turbo, 21/10): an answer, an objection
 * ("já tenho", "tá caro", "agora não", "vou pensar"), a clear refusal, a question.
 * Read in context by the model, never by a word list, so every phrasing is covered.
 */
export const interpreterIntentValues = ["answer", "objection", "decline", "question", "other"] as const;
export type InterpreterIntent = (typeof interpreterIntentValues)[number];

export const interpreterOutputSchema = z.object({
  memoryUpdates: z.array(MemoryUpdateSchema).max(8).default([]),
  confidence: z.number().min(0).max(1).optional(),
  intent: z.enum(interpreterIntentValues).optional().catch(undefined),
  objectionType: z.string().max(40).optional().catch(undefined),
  /** Only for objection/decline: the recovery message written for this customer. */
  reply: z.string().max(700).optional().catch(undefined),
});

const OUTPUT_INSTRUCTION = `
FORMATO DE RESPOSTA: responda APENAS com um JSON válido, sem markdown e sem texto fora dele:
{"memoryUpdates": [{"field": "planType", "value": "familiar", "confidence": 1}], "confidence": 0.9, "intent": "answer"}
"memoryUpdates" lista só fatos que o cliente informou; vazio quando não houver nenhum.
"intent": "answer" (respondeu ou deu dados), "objection" (hesitação ou objeção: já tem plano, preço, não é o momento, vai pensar, desconfiança, quer só informação), "decline" (recusa clara de continuar), "question" (fez uma pergunta), "other".
Quando "intent" for "objection" ou "decline", preencha "objectionType" (ja_tem_plano, preco, momento, pensar, desconfianca, sem_interesse, outro) e "reply": uma mensagem curta (até 3 frases, português do Brasil de WhatsApp, sem travessão, sem emojis). Primeiro acolha ("entendo", "faz sentido"), sem culpar o cliente e sem "infelizmente" nem "lamento". Depois pergunte o motivo com uma pergunta só e ofereça pelo menos dois caminhos concretos (comparar com o plano atual, cotar para outra pessoa da família, falar por ligação, voltar em outro momento). Não prometa preço, desconto, cobertura, privacidade nem prazo de retorno.`;

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
  intent?: InterpreterIntent;
  objectionType?: string;
  reply?: string;
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
      maxTokens: 450,
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
    return {
      ok: true,
      memoryUpdates: result.value.memoryUpdates,
      intent: result.value.intent,
      objectionType: result.value.objectionType,
      reply: result.value.reply?.replace(/\s*[—–]\s*/g, ", ").trim() || undefined,
      modelUsed: `${result.model.provider}/${result.model.model}`,
      latencyMs,
      attempts: result.attempts,
    };
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

/**
 * Second opinion on what the rules read from a longer message (case Edivaldo, 21/10:
 * "tenho 63 anos ... tenho 63 anos" became "2 pessoas, 63 e 63"). The model only
 * confirms or corrects age, number of people and plan type; giving up keeps the rules.
 */
export const VERIFIABLE_FIELDS = ["age", "numberOfLives", "planType"] as const;
export type VerifiableField = (typeof VERIFIABLE_FIELDS)[number];

const verificationSchema = z.object({
  correct: z.boolean().catch(true),
  corrections: z.array(z.object({
    field: z.enum(VERIFIABLE_FIELDS),
    value: z.string().max(80).nullable(),
  })).max(3).catch([]),
});

/** Worth a check: a longer sentence, or more than one number. Short answers ("35") are trusted. */
export function shouldVerifyExtraction(message: string) {
  const numbers = message.match(/\d+/g)?.length ?? 0;
  return message.trim().length >= 25 || numbers >= 2;
}

export async function verifyExtractedFacts(input: {
  tenantId: string;
  conversationId: string;
  leadId?: string | null;
  sourceMessageId?: string | null;
  message: string;
  lastQuestion?: string | null;
  facts: Partial<Record<VerifiableField, string>>;
}): Promise<{ ok: boolean; corrections: Array<{ field: VerifiableField; value: string | null }>; model: string }> {
  const { runGateway } = await import("@/features/ai-gateway/gateway");
  const system = [
    "Você confere fatos que regras automáticas leram da mensagem de um cliente numa qualificação de plano de saúde.",
    "Corrija só o que estiver errado e nada mais:",
    "- age: idades das pessoas do plano, separadas por vírgula, uma por pessoa. A mesma pessoa repetindo a própria idade conta uma vez.",
    "- numberOfLives: quantas pessoas entram no plano (número inteiro).",
    "- planType: individual, familiar ou empresarial.",
    "Use value null para remover um fato que a mensagem não informa. Não invente dados.",
    'Responda APENAS com JSON: {"correct": true, "corrections": []} ou {"correct": false, "corrections": [{"field": "numberOfLives", "value": "1"}]}',
  ].join("\n");
  const user = [
    input.lastQuestion ? `Pergunta feita ao cliente: "${input.lastQuestion}"` : "",
    `Mensagem do cliente: "${input.message.slice(0, 600)}"`,
    `Fatos lidos pelas regras: ${JSON.stringify(input.facts)}`,
  ].filter(Boolean).join("\n");
  try {
    const result = await runGateway({
      profile: "interpreter",
      purpose: "qualification_verification",
      tenantId: input.tenantId,
      userId: `conversation:${input.conversationId}`,
      conversationId: input.conversationId,
      leadId: input.leadId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      // The customer's conversation: only paid models that do not train on it (LGPD art. 11).
      sensitive: true,
      temperature: 0,
      maxTokens: 200,
      timeoutMs: INTERPRETER_TIMEOUT_MS,
      maxAttempts: INTERPRETER_MAX_ATTEMPTS,
      schema: verificationSchema,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    });
    if (!result.ok) return { ok: false, corrections: [], model: RULE_ENGINE_MODEL };
    return { ok: true, corrections: result.value.correct ? [] : result.value.corrections, model: `${result.model.provider}/${result.model.model}` };
  } catch {
    return { ok: false, corrections: [], model: RULE_ENGINE_MODEL };
  }
}
