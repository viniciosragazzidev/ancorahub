/**
 * Phase 3 — Guardrail Pipeline
 *
 * Every AI response runs through this pipeline before being sent to the customer.
 * If ANY guardrail blocks, the response is NEVER forwarded to WhatsApp.
 *
 * The pipeline is designed to be:
 * - Extensible: add new guardrails by implementing the Guardrail interface
 * - Composable: guardrails run in sequence, each receiving the full context
 * - Auditable: each guardrail logs its decision
 * - Fail-safe: if a guardrail errors, the response is blocked (fail-closed)
 */

import type { ConversationMemory } from "./memory";
import type { AiStructuredResponse } from "./ai-response-schema";
import type { ConversationStatus } from "./conversation-state-machine";
import { detectLanguage } from "./service";

// ─── Types ───────────────────────────────────────────────────────────────────
// ConversationStatus is imported from conversation-state-machine.ts
// to avoid type drift between the two files.

export interface GuardrailContext {
  /** The structured response the AI generated */
  response: AiStructuredResponse;

  /** The raw text the AI returned (may be relevant for some checks) */
  rawText: string;

  /** Current conversation memory */
  memory: ConversationMemory;

  /** Current conversation status in the DB */
  conversationStatus: ConversationStatus;

  /** Tenant ID for isolation checks */
  tenantId: string;

  /** Conversation ID for logging */
  conversationId: string;

  /** Lead ID for logging */
  leadId?: string;

  /** The user's message that triggered this response */
  userMessage: string;

  /** Collected fields before this turn */
  collectedFieldsBefore: string[];
}

export interface GuardrailResult {
  passed: boolean;
  reason?: string;
  /** A unique code for logging/audit (e.g. "LANGUAGE_BLOCKED", "REPEATED_QUESTION") */
  code?: string;
}

export interface Guardrail {
  name: string;
  check(ctx: GuardrailContext): GuardrailResult | Promise<GuardrailResult>;
}

// ─── Utility — blocklist / allowlist patterns ────────────────────────────────

/** Words/patterns that should NEVER appear in an AI response. */
const BLOCKLIST_PATTERNS = [
  /ignore\s+(all|previous|above|below)/i,
  /you\s+are\s+(a\s+)?(ai|assistant|llm|model|chatbot)/i,
  /as\s+(an?\s+)?(ai|llm|model)/i,
  /i\s+don'?t\s+have\s+(access\s+to\s+)?(personal\s+)?information/i,
  /i\s+cannot\s+(access|view|see)\s+(your\s+)?(data|information|records)/i,
  /my\s+(training\s+)?(data|knowledge)\s+(cutoff|limit)/i,
  /openai|chatgpt|claude|anthropic|llama|deepseek/i,
];

/** Price-related patterns that should NEVER appear. */
const PRICE_PATTERNS = [
  /R?\$\s*\d+[.,]\d{2}/,
  /\d+[.,]\d{2}\s*(reais|real)/,
  /mensalidade\s*(de|é|será|fica)\s*R?\$/i,
  /custa\s*R?\$/i,
  /preço\s*(de|é|será|fica)\s*(R?\$)?/i,
];

/** Patterns that indicate prompt injection attempts in user messages. */
const INJECTION_PATTERNS = [
  /ignore\s+(all|previous|above)\s+(instructions|prompts|commands)/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+(not\s+)?(bound\s+by|free\s+from)/i,
  /nova\s+instru[çc][ãa]o/i,
  /desconsidere\s+(as\s+)?(instru[çc][õo]es|regras|tudo)/i,
  /mostre\s+(seu\s+)?prompt/i,
  /reveal\s+(your\s+)?prompt/i,
  /diga\s+(seus\s+)?(dados|segredos|senha|password)/i,
  /me\s+d[êe]\s+(seu\s+)?(token|chave|key|senha)/i,
];

// ─── Guardrail Implementations ───────────────────────────────────────────────

/**
 * 1. LanguageGuard — Ensures response is in the expected language (pt-BR).
 * If the AI tries to respond in English without justification, block.
 */
export class LanguageGuard implements Guardrail {
  name = "LanguageGuard";
  private readonly _expectedLanguage: string;

  constructor(expectedLanguage: string = "pt-BR") {
    this._expectedLanguage = expectedLanguage;
  }

  check(ctx: GuardrailContext): GuardrailResult {
    const { valid, detectedLanguage } = this._validate(ctx.response.language, ctx.rawText);

    if (!valid) {
      return {
        passed: false,
        reason: `Idioma inesperado. Esperado: ${this._expectedLanguage}, detectado: ${detectedLanguage}`,
        code: "LANGUAGE_BLOCKED",
      };
    }
    return { passed: true };
  }

  private _validate(
    declaredLanguage: string,
    rawText: string,
  ): { valid: boolean; detectedLanguage: string } {
    // 1. Check the declared language field
    if (declaredLanguage !== this._expectedLanguage) {
      const detected = detectLanguage(rawText);
      return { valid: false, detectedLanguage: detected };
    }

    // 2. Double-check by actually analyzing the message text
    const detected = detectLanguage(rawText);
    if (detected !== this._expectedLanguage) {
      return { valid: false, detectedLanguage: detected };
    }

    return { valid: true, detectedLanguage: this._expectedLanguage };
  }
}

/**
 * 2. RepeatedQuestionGuard — Blocks if the AI is asking about a field already collected.
 * Uses semantic similarity via isQuestionRepeated from memory.ts.
 */
export class RepeatedQuestionGuard implements Guardrail {
  name = "RepeatedQuestionGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const question = ctx.response.questionAsked;
    if (!question) {
      return { passed: true }; // Not asking a question, fine
    }

    // Check if the field being asked is already collected
    if (ctx.memory.collectedFields.includes(question.field)) {
      return {
        passed: false,
        reason: `Pergunta repetida: campo "${question.field}" já coletado`,
        code: "REPEATED_QUESTION",
      };
    }

    // Check semantic similarity for known question patterns
    const lowerMessage = ctx.response.message.toLowerCase();
    const knownFieldSynonyms: Record<string, string[]> = {
      customerName: [
        "qual é o seu nome", "como você se chama", "como posso te chamar",
        "me diga seu nome", "seu nome", "nome", "com quem eu falo",
        "qual seu nome",
      ],
      planType: [
        "que tipo de plano", "individual ou empresarial", "pf ou pj",
        "para você ou empresa", "busca plano individual",
        "para pessoa física ou jurídica",
      ],
      city: ["qual sua cidade", "de onde você é", "onde você mora", "em qual cidade"],
      age: ["qual sua idade", "quantos anos você tem", "sua idade"],
      numberOfLives: ["quantas pessoas", "número de vidas", "quantos beneficiários"],
      email: ["qual seu email", "seu email", "e-mail"],
    };

    for (const [field, synonyms] of Object.entries(knownFieldSynonyms)) {
      if (ctx.memory.collectedFields.includes(field)) {
        for (const synonym of synonyms) {
          if (lowerMessage.includes(synonym)) {
            return {
              passed: false,
              reason: `Pergunta repetida detectada: campo "${field}" (sinônimo: "${synonym}")`,
              code: "REPEATED_QUESTION_SEMANTIC",
            };
          }
        }
      }
    }

    return { passed: true };
  }
}

/**
 * 3. ConversationResetGuard — Blocks if the AI tries to restart the conversation
 * (e.g., introducing itself again after the first turn).
 */
export class ConversationResetGuard implements Guardrail {
  name = "ConversationResetGuard";
  private readonly _initialGreetingKeywords = [
    "sou a assistente virtual", "sou a assistente inteligente",
    "me chamo", "sou a atendente virtual",
    "assistente virtual da corretora",
    "assistente virtual da ancora",
    "bem-vindo à ancora",
  ];

  check(ctx: GuardrailContext): GuardrailResult {
    // Only check for resets if we already have customer info
    const hasCustomerName = !!ctx.memory.customerName?.value;
    const hasCollectedFields = ctx.memory.collectedFields.length > 0;

    if (!hasCustomerName && !hasCollectedFields) {
      return { passed: true }; // No data yet, intro is fine
    }

    const lowerMessage = ctx.response.message.toLowerCase();
    const isReset = this._initialGreetingKeywords.some((k) => lowerMessage.includes(k));

    if (isReset) {
      return {
        passed: false,
        reason: "IA tentou reiniciar a conversa (apresentação novamente com dados já coletados)",
        code: "CONVERSATION_RESET",
      };
    }

    return { passed: true };
  }
}

/**
 * 4. StateTransitionGuard — Validates state transitions are legal.
 */
export class StateTransitionGuard implements Guardrail {
  name = "StateTransitionGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const currentStatus = ctx.conversationStatus;

    // If conversation is CLOSED or FAILED, no response should be sent
    if (currentStatus === "CLOSED" || currentStatus === "FAILED") {
      return {
        passed: false,
        reason: `Conversa em estado ${currentStatus}. IA não pode responder.`,
        code: "STATE_CLOSED",
      };
    }

    // If AI says shouldTransfer, check it's warranted
    if (ctx.response.shouldTransfer && ctx.response.detectedIntent !== "requesting_human") {
      // If transfer is requested but intent doesn't match, flag it
      // but don't block — the intent detection might be wrong
      console.warn("[guardrail] transfer_intent_mismatch", {
        conversationId: ctx.conversationId,
        intent: ctx.response.detectedIntent,
      });
    }

    return { passed: true };
  }
}

/**
 * 5. KnownFieldsGuard — Blocks if the AI asks about a field that is already in memory.
 * More aggressive than RepeatedQuestionGuard: checks even if questionAsked is not set.
 */
export class KnownFieldsGuard implements Guardrail {
  name = "KnownFieldsGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const message = ctx.response.message.toLowerCase();
    const collected = ctx.memory.collectedFields;

    // If name is known, check for name-asking patterns
    if (collected.includes("customerName") && ctx.memory.customerName?.value) {
      const namePatterns = [
        /qual (é o seu|o) nome/i,
        /como (você se chama|se chama|te chamas)/i,
        /me diga (o )?seu nome/i,
        /nome do cliente/i,
        /nome completo/i,
      ];
      for (const pattern of namePatterns) {
        if (pattern.test(message)) {
          return {
            passed: false,
            reason: `Campo "customerName" já coletado (${ctx.memory.customerName.value})`,
            code: "KNOWN_FIELD_ASKED",
          };
        }
      }
    }

    // If city is known
    if (collected.includes("city") && ctx.memory.city?.value) {
      if (/onde você mora|qual (sua|a) cidade|de onde você é/.test(message)) {
        return {
          passed: false,
          reason: `Campo "city" já coletado (${ctx.memory.city.value})`,
          code: "KNOWN_FIELD_ASKED",
        };
      }
    }

    return { passed: true };
  }
}

/**
 * 6. PricingGuard — Blocks any response that mentions specific prices, values, or costs.
 */
export class PricingGuard implements Guardrail {
  name = "PricingGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const message = ctx.rawText;

    for (const pattern of PRICE_PATTERNS) {
      if (pattern.test(message)) {
        return {
          passed: false,
          reason: "Resposta contém valores de preço proibidos",
          code: "PRICE_MENTIONED",
        };
      }
    }

    return { passed: true };
  }
}

/**
 * 7. HallucinationGuard — Blocks responses that claim things outside the AI's knowledge.
 */
export class HallucinationGuard implements Guardrail {
  name = "HallucinationGuard";

  // These are safe to mention
  private readonly _allowedGeneralClaims = [
    "ancora corretora", "corretora", "plano de saúde", "planos de saúde",
    "ans", "cobertura", "carência", "coparticipação",
    "rede credenciada", "nacional", "ambulatorial", "hospitalar",
  ];

  check(ctx: GuardrailContext): GuardrailResult {
    const message = ctx.rawText.toLowerCase();
    const memory = ctx.memory;

    // Check for unsupported guarantees
    const guaranteePatterns = [
      /(100%|total|completa)\s+(de\s+)?(cobertura|reembolso)/i,
      /(cobre|inclui|abrange)\s+(tudo|qualquer|todas)/i,
      /sem\s+(qualquer\s+)?(carência|prazo|burocracia)/i,
      /(melhor|mais\s+barato|mais\s+em conta)\s+(preço|plano|valor)/i,
      /garanto|garantimos|certeza\s+(que|absoluta)/i,
    ];

    for (const pattern of guaranteePatterns) {
      if (pattern.test(message)) {
        return {
          passed: false,
          reason: "Resposta contém garantia ou promessa absoluta não verificável",
          code: "HALLUCINATION_GUARANTEE",
        };
      }
    }

    // Check for specific plan/facility claims
    if (
      /(hospital|médico|consulta|exame)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/.test(message) &&
      !message.includes("exemplo")
    ) {
      // Naming specific hospitals/doctors is risky without a catalog lookup
      return {
        passed: false,
        reason: "Resposta menciona estabelecimento específico sem verificação em catálogo",
        code: "HALLUCINATION_FACILITY",
      };
    }

    return { passed: true };
  }
}

/**
 * 8. HumanTakeoverGuard — Blocks AI responses if a human is already active.
 */
export class HumanTakeoverGuard implements Guardrail {
  name = "HumanTakeoverGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    if (ctx.conversationStatus === "HUMAN_ACTIVE") {
      return {
        passed: false,
        reason: "Humano ativo na conversa. IA não pode responder.",
        code: "HUMAN_ACTIVE",
      };
    }
    return { passed: true };
  }
}

/**
 * 9. MessageLengthGuard — Blocks overly long messages (WhatsApp-friendly).
 */
export class MessageLengthGuard implements Guardrail {
  name = "MessageLengthGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const message = ctx.response.message;
    if (message.length > 500) {
      return {
        passed: false,
        reason: `Mensagem muito longa (${message.length} caracteres). Máximo 500.`,
        code: "MESSAGE_TOO_LONG",
      };
    }

    // Also check for excessive line breaks or bullet lists
    const lineBreaks = (message.match(/\n/g) || []).length;
    if (lineBreaks > 5) {
      return {
        passed: false,
        reason: `Mensagem com muitas quebras de linha (${lineBreaks}). WhatsApp-friendly requer no máximo 5.`,
        code: "MESSAGE_TOO_MANY_LINES",
      };
    }

    return { passed: true };
  }
}

/**
 * 10. SensitiveDataGuard — Blocks responses that might leak sensitive information.
 */
export class SensitiveDataGuard implements Guardrail {
  name = "SensitiveDataGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    // Check for blocklist patterns
    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(ctx.rawText)) {
        return {
          passed: false,
          reason: `Resposta contém padrão bloqueado: "${pattern.source.slice(0, 50)}"`,
          code: "SENSITIVE_CONTENT",
        };
      }
    }

    return { passed: true };
  }
}

/**
 * 11. PromptInjectionGuard — Checks the user message for injection attempts.
 * This is a pre-generation guardrail that affects whether we should respond at all.
 */
export class PromptInjectionGuard implements Guardrail {
  name = "PromptInjectionGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const userMessage = ctx.userMessage.toLowerCase();

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(userMessage)) {
        return {
          passed: false,
          reason: `Possível tentativa de injeção de prompt detectada na mensagem do usuário`,
          code: "PROMPT_INJECTION",
        };
      }
    }

    return { passed: true };
  }
}

/**
 * 12. UnsupportedPromiseGuard — Blocks promises the system can't fulfill
 * (e.g., specific discount guarantees, same-day approval).
 */
export class UnsupportedPromiseGuard implements Guardrail {
  name = "UnsupportedPromiseGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const message = ctx.rawText.toLowerCase();

    const promisePatterns = [
      /(vou|irei|posso)\s+(resolver|finalizar|concluir|aprovar)\s+(tudo|hoje|agora|j[áa])/i,
      /(em\s+)?(at[ée]|no\s+m[áa]ximo)\s+\d+\s+(minutos|horas|dias)/i,
      /(resolvemos|aprovamos|conclu[íi]mos)\s+(em|r[áa]pido|na\s+hora)/i,
      /(desconto|economia|economize)\s+(de|garantido|certeza)/i,
    ];

    for (const pattern of promisePatterns) {
      if (pattern.test(message)) {
        return {
          passed: false,
          reason: "Resposta contém promessa não verificável de prazo/resultado",
          code: "UNSUPPORTED_PROMISE",
        };
      }
    }

    return { passed: true };
  }
}

/**
 * 13. ApologyGuard — Blocks unnecessary apologies.
 */
export class ApologyGuard implements Guardrail {
  name = "ApologyGuard";

  check(ctx: GuardrailContext): GuardrailResult {
    const message = ctx.response.message.toLowerCase();
    const memory = ctx.memory;

    // If the customer didn't complain or express frustration
    const customerComplained = memory.objections?.value?.toLowerCase().includes("demora") ||
      ctx.userMessage.toLowerCase().includes("demorou");

    const apologyPatterns = [
      /(me\s+)?(desculpa|desculpe|sinto\s+muito|lamento|perdão)/i,
    ];

    for (const pattern of apologyPatterns) {
      if (pattern.test(message) && !customerComplained) {
        return {
          passed: false,
          reason: "IA pediu desculpas sem motivo claro",
          code: "UNNECESSARY_APOLOGY",
        };
      }
    }

    return { passed: true };
  }
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

export type PipelineResult =
  | { passed: true; blockedBy: null }
  | { passed: false; blockedBy: string; reason: string; code: string };

/**
 * Runs all guardrails in sequence. If any guardrail blocks, returns immediately
 * with the blocking guardrail's result. Otherwise returns { passed: true }.
 *
 * Fail-closed: if a guardrail throws, it's treated as a block.
 */
export async function runGuardrailPipeline(
  guardrails: Guardrail[],
  ctx: GuardrailContext,
): Promise<PipelineResult> {
  for (const guardrail of guardrails) {
    try {
      const result = await guardrail.check(ctx);
      if (!result.passed) {
        console.warn("[guardrail] blocked", {
          guardrail: guardrail.name,
          code: result.code,
          reason: result.reason,
          conversationId: ctx.conversationId,
          tenantId: ctx.tenantId,
        });
        return {
          passed: false,
          blockedBy: guardrail.name,
          reason: result.reason ?? "Bloqueado sem motivo específico",
          code: result.code ?? "GUARDRAIL_BLOCKED",
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[guardrail] exception", {
        guardrail: guardrail.name,
        error: errorMessage,
        conversationId: ctx.conversationId,
      });
      // Fail-closed: exception = block
      return {
        passed: false,
        blockedBy: guardrail.name,
        reason: `Guardrail exception: ${errorMessage}`,
        code: "GUARDRAIL_EXCEPTION",
      };
    }
  }

  return { passed: true, blockedBy: null };
}

/**
 * Creates the standard guardrail pipeline for the AI agent.
 * Guardrails are ordered: cheap checks first, expensive checks last.
 */
export function createDefaultGuardrailPipeline(expectedLanguage: string = "pt-BR"): Guardrail[] {
  return [
    // State checks (fast, no parsing needed)
    new HumanTakeoverGuard(),
    new StateTransitionGuard(),

    // Content integrity checks
    new LanguageGuard(expectedLanguage),
    new MessageLengthGuard(),
    new SensitiveDataGuard(),

    // Business logic checks
    new KnownFieldsGuard(),
    new RepeatedQuestionGuard(),
    new ConversationResetGuard(),
    new ApologyGuard(),
    new PricingGuard(),
    new HallucinationGuard(),
    new UnsupportedPromiseGuard(),

    // Security checks
    new PromptInjectionGuard(),
  ];
}
