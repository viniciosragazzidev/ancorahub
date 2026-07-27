/**
 * Phase 3 — Structured AI Response Schema (Zod)
 *
 * The AI must respond in valid JSON matching this schema. The backend validates
 * every response before sending it to the customer. Invalid responses are
 * rejected (with one retry), never forwarded to WhatsApp.
 */

import { z } from "zod";

/**
 * Detected customer intent, used by guardrails to validate state transitions
 * and by the UI to show the agent's current reasoning.
 */
export const IntentEnum = z.enum([
  "greeting",
  "collecting_info",
  "providing_info",
  "answering_question",
  "requesting_human",
  "clarifying",
  "confirming",
  "closing",
  "other",
]);
export type AiIntent = z.infer<typeof IntentEnum>;

/**
 * A memory update the AI proposes the backend should persist.
 * The backend validates before applying.
 */
export const MemoryUpdateSchema = z.object({
  field: z.string().min(1).max(40),
  value: z.string().min(1).max(200),
  confidence: z.number().min(0).max(1).default(1),
});
export type AiMemoryUpdate = z.infer<typeof MemoryUpdateSchema>;

/**
 * The complete structured response the AI must return.
 *
 * The ONLY field sent to the customer is `message`. All other fields are
 * metadata for the backend to validate, log, and act upon.
 */
export const AiResponseSchema = z.object({
  /** The actual message sent to the customer via WhatsApp. Max ~3 short sentences. */
  message: z.string().min(1).max(500),

  /** Language of the generated message. Must match tenant's expected language. */
  language: z.enum(["pt-BR", "en"]).default("pt-BR"),

  /** What the AI thinks the customer's intent is in this turn. */
  detectedIntent: IntentEnum.default("answering_question"),

  /** The conversation step the AI believes it is currently on. */
  currentStep: z
    .enum([
      "GREETING",
      "IDENTIFYING_CUSTOMER",
      "UNDERSTANDING_INTENT",
      "COLLECTING_INFORMATION",
      "QUALIFYING",
      "PRESENTING_NEXT_STEP",
      "WAITING_CUSTOMER",
      "WAITING_HUMAN",
    ])
    .optional(),

  /** The step the AI intends to transition to after this message. */
  nextStep: z
    .enum([
      "GREETING",
      "IDENTIFYING_CUSTOMER",
      "UNDERSTANDING_INTENT",
      "COLLECTING_INFORMATION",
      "QUALIFYING",
      "PRESENTING_NEXT_STEP",
      "WAITING_CUSTOMER",
      "WAITING_HUMAN",
    ])
    .optional(),

  /** Whether the AI recommends transferring to a human agent. */
  shouldTransfer: z.boolean().default(false),

  /** Why the transfer is needed (required if shouldTransfer is true). */
  transferReason: z.string().max(200).nullable().optional(),

  /** Whether the AI should wait for the customer's response before proceeding. */
  shouldWait: z.boolean().default(true),

  /** If the AI is asking a question, which field it's trying to collect. */
  questionAsked: z
    .object({
      field: z.string().min(1).max(40),
      text: z.string().min(1).max(200),
    })
    .nullable()
    .optional(),

  /** Proposed updates to the conversation memory. Validated before applying. */
  memoryUpdates: z.array(MemoryUpdateSchema).max(5).optional(),

  /** How confident the AI is in this response (0-1). Below 0.7 triggers extra scrutiny. */
  confidence: z.number().min(0).max(1).optional(),
});

export type AiStructuredResponse = z.infer<typeof AiResponseSchema>;

/**
 * Validates an unknown value against the AiResponseSchema.
 * Returns either the parsed response or a list of validation errors.
 */
export function validateAiResponse(
  raw: unknown,
): { success: true; data: AiStructuredResponse } | { success: false; errors: z.ZodError } {
  const result = AiResponseSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Serves as a safe fallback when the AI produces invalid or unparseable JSON.
 * Never leaves the customer without a reply.
 */
export function createSafeFallbackResponse(
  customerName?: string | null,
  memoryContext?: string,
): AiStructuredResponse {
  const pendingLine = memoryContext?.split("DADOS AINDA NECESSÁRIOS:")[1]?.split("\n").find((line) => line.trim().startsWith("-"));
  const pendingField = pendingLine?.replace(/^\s*-\s*/, "").trim().toLowerCase();
  const name = customerName?.split(" ")[0];
  const prefix = name ? `Perfeito, ${name}. ` : "Perfeito. ";
  const followUps: Record<string, { message: string; field: string }> = {
    "nome completo": { message: "Como você prefere ser chamado(a)?", field: "customerName" },
    cidade: { message: "Em qual cidade você mora?", field: "city" },
    "tipo de plano": { message: "O plano seria individual, familiar ou empresarial?", field: "planType" },
    "n° de vidas": { message: "Quantas pessoas serão incluídas no plano?", field: "numberOfLives" },
    idade: { message: "Qual é a idade da pessoa que será incluída?", field: "age" },
    "e-mail": { message: "Qual e-mail podemos usar para continuar o atendimento?", field: "email" },
  };
  const followUp = pendingField ? followUps[pendingField] : undefined;
  return {
    message: followUp
      ? `${prefix}${followUp.message}`
      : customerName
      ? `${customerName}, recebi sua mensagem. Pode me contar um pouco mais sobre o que você está procurando?`
      : "Recebi sua mensagem! Pode me contar um pouco mais sobre o que você está procurando?",
    language: "pt-BR",
    detectedIntent: "collecting_info",
    shouldTransfer: false,
    shouldWait: true,
    questionAsked: followUp ? { field: followUp.field, text: followUp.message } : undefined,
    confidence: 0.5,
  };
}

/**
 * JSON output instruction injected into the system prompt.
 */
export const JSON_OUTPUT_INSTRUCTION = `
FORMATO DE RESPOSTA — REGRA ABSOLUTA:
Você DEVE responder APENAS com um JSON válido no seguinte formato. NÃO escreva texto fora do JSON.
NÃO use markdown, NÃO use \`\`\`json, NÃO use explicações. Apenas o JSON.

{
  "message": "Sua mensagem para o cliente aqui (máximo 3 frases curtas, em português brasileiro)",
  "language": "pt-BR",
  "detectedIntent": "collecting_info",
  "currentStep": "COLLECTING_INFORMATION",
  "nextStep": "COLLECTING_INFORMATION",
  "shouldTransfer": false,
  "transferReason": null,
  "shouldWait": true,
  "questionAsked": {
    "field": "planType",
    "text": "O plano seria individual, familiar ou empresarial?"
  },
  "memoryUpdates": [
    { "field": "planType", "value": "individual", "confidence": 1 }
  ],
  "confidence": 0.95
}

Regras do JSON:
- "message" é a ÚNICA parte enviada ao cliente. Máximo 500 caracteres, 3 frases.
- "language" deve ser "pt-BR" (NUNCA mude para outro idioma sem o cliente pedir explicitamente).
- "detectedIntent" descreve o que o cliente quer com base na mensagem dele.
- "shouldTransfer": true APENAS se o cliente pediu explicitamente para falar com humano.
- "questionAsked" preenchido APENAS se você estiver fazendo uma pergunta. Nulo se estiver respondendo.
- "memoryUpdates" lista APENAS informações NOVAS que o cliente forneceu nesta mensagem.
- "confidence" entre 0 e 1. Se estiver em dúvida, use valor mais baixo.`;
