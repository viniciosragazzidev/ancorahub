import { z } from "zod";

/**
 * Lateral answer for the qualification engine (fase 5): when the customer asks
 * something instead of answering the pending question, the agent answers in
 * one or two sentences with what the company registered, then the script
 * resumes. It never states prices, coverage or waiting periods, and any
 * failure keeps the scripted reply exactly as before.
 */

const QUESTION_WORDS = /\b(qual|quais|quanto|quanta|quantos|quantas|como|onde|quando|porque|por que|o que|voc[eê]s|tem|t[eê]m|aceita|aceitam|cobre|cobrem|atende|atendem|funciona|existe|existem|pode|posso|consigo)\b/i;

/** Whether the customer's message is a question to be answered before resuming the script. */
export function isCustomerQuestion(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 400) return false;
  if (trimmed.includes("?")) return true;
  return /^(qual|quais|quanto|quanta|como|onde|quando|o que|voc[eê]s|tem|aceita|cobre|atende|existe)\b/i.test(trimmed) && QUESTION_WORDS.test(trimmed);
}

const PRICE_OR_PROMISE = /R\$|\breais\b|\d+[.,]\d{2}\b|\d+\s*%|\bcar[eê]ncia\b|\bgarant(o|imos|ido)\b|\bgr[aá]tis\b|\bdesconto\b/i;

/**
 * Keeps at most two short statements from the model: questions are dropped
 * (the script asks the next one), and an answer with a price, a percentage,
 * a waiting period or a promise is refused as a whole.
 */
export function sanitizeLateralAnswer(raw: string | null | undefined) {
  const text = (raw ?? "").replace(/\[SOLICITOU_HUMANO\]/g, "").replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ").trim();
  if (!text || PRICE_OR_PROMISE.test(text)) return null;
  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [];
  const statements = sentences.filter((sentence) => !sentence.endsWith("?")).slice(0, 2);
  const answer = statements.join(" ").trim();
  if (answer.length < 8) return null;
  return answer.length > 320 ? `${answer.slice(0, 317).trimEnd()}…` : answer;
}

export function buildLateralAnswerPrompt(input: { assistantName: string; companyName: string; businessContext: string; situational: string; customInstructions: string }) {
  return [
    `Você é ${input.assistantName}, atendente virtual da ${input.companyName}, corretora de planos de saúde, conversando no WhatsApp.`,
    "O cliente fez uma pergunta no meio do atendimento. Responda a pergunta em no máximo 2 frases curtas, em português, de forma acolhedora.",
    "Use somente as informações abaixo. Se a resposta não estiver nelas, diga que o corretor vai detalhar isso na cotação.",
    "Nunca informe preços, valores, percentuais, carências, coberturas específicas ou prazos, e não prometa nada. Não faça perguntas: a próxima pergunta será feita pelo sistema.",
    "",
    `SOBRE A EMPRESA: ${input.businessContext}`,
    input.situational ? `\n${input.situational}` : "",
    input.customInstructions ? `\nINSTRUÇÕES DA EMPRESA:\n${input.customInstructions}` : "",
  ].join("\n");
}

const DEFAULT_CONTEXT = "Corretora especializada em planos de saúde individuais, familiares e empresariais, com as principais operadoras.";
/** Per model; the gateway tries two models at most, so the turn waits 8 s in the worst case. */
const LATERAL_TIMEOUT_MS = 4_000;
const LATERAL_MAX_ATTEMPTS = 2;
const LATERAL_JSON_INSTRUCTION = 'Responda APENAS com um JSON válido, sem markdown: {"answer": "sua resposta ao cliente"}.';

export const lateralAnswerOutputSchema = z.object({ answer: z.string().max(2000) });

/**
 * Short answer to the customer's question, or null (then the scripted reply goes alone).
 * Goes through the AI gateway ("interpreter" profile: fast model + a second one), like
 * the qualification interpreter; every attempt is logged by the gateway, and giving up
 * is logged with status "fallback" and the reason.
 */
export async function generateLateralAnswer(input: { tenantId: string; question: string; customerFirstName?: string | null; conversationId?: string | null; leadId?: string | null }) {
  const startedAt = Date.now();
  const { logAiUsage } = await import("./ai-usage-log");
  const giveUp = (error: string) => {
    void logAiUsage({ tenantId: input.tenantId, purpose: "lateral_answer", model: "scripted-reply", startedAt, success: false, status: "fallback", error, conversationId: input.conversationId, leadId: input.leadId });
    return null;
  };
  try {
    const [{ getQualificationTenantSettings }, { getTenantPlaybooks }, { buildSituationalPromptSection }, { runGateway }] = await Promise.all([
      import("@/features/ai-qualification/tenant-settings-service"),
      import("@/features/ai-qualification/playbooks-storage"),
      import("@/features/ai-qualification/situational-response-engine"),
      import("@/features/ai-gateway/gateway"),
    ]);
    const [settings, playbooks] = await Promise.all([
      getQualificationTenantSettings(input.tenantId).catch(() => null),
      getTenantPlaybooks(input.tenantId).catch(() => []),
    ]);
    const assistantName = settings?.assistantName?.trim() || "Ana";
    const system = buildLateralAnswerPrompt({
      assistantName,
      companyName: "Âncora Saúde",
      businessContext: settings?.businessContext?.trim() || DEFAULT_CONTEXT,
      situational: buildSituationalPromptSection({ playbooks, variables: { assistente_nome: assistantName, corretora_nome: "Âncora Saúde", cliente_nome: input.customerFirstName ?? "" } }),
      customInstructions: settings?.customInstructions?.trim() ?? "",
    });
    const result = await runGateway({
      profile: "interpreter",
      purpose: "lateral_answer",
      tenantId: input.tenantId,
      userId: `conversation:${input.conversationId ?? "lateral"}`,
      conversationId: input.conversationId ?? null,
      leadId: input.leadId ?? null,
      // The customer's own words: only paid models that do not train on them (LGPD art. 11).
      sensitive: true,
      temperature: 0.3,
      maxTokens: 200,
      timeoutMs: LATERAL_TIMEOUT_MS,
      maxAttempts: LATERAL_MAX_ATTEMPTS,
      schema: lateralAnswerOutputSchema,
      messages: [{ role: "system", content: `${system}

${LATERAL_JSON_INSTRUCTION}` }, { role: "user", content: input.question }],
    });
    if (!result.ok) return giveUp([result.reason, result.lastError].filter(Boolean).join(": "));
    const answer = sanitizeLateralAnswer(result.value.answer);
    if (!answer) return giveUp("refused_or_empty");
    return answer;
  } catch (error) {
    console.warn("[qualification] lateral_answer_failed_open", { tenantId: input.tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown_error" });
    return giveUp(error instanceof Error ? error.message : "unknown_error");
  }
}
