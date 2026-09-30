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
const LATERAL_TIMEOUT_MS = 8_000;

/** Short answer to the customer's question, or null (then the scripted reply goes alone). */
export async function generateLateralAnswer(input: { tenantId: string; question: string; customerFirstName?: string | null; conversationId?: string | null; leadId?: string | null }) {
  const startedAt = Date.now();
  let model = "";
  try {
    const [{ getQualificationTenantSettings }, { getTenantPlaybooks }, { buildSituationalPromptSection }, { createAiRouter }, { logAiUsage }] = await Promise.all([
      import("@/features/ai-qualification/tenant-settings-service"),
      import("@/features/ai-qualification/playbooks-storage"),
      import("@/features/ai-qualification/situational-response-engine"),
      import("./model-router"),
      import("./ai-usage-log"),
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
    const router = await createAiRouter(input.tenantId);
    if (!router.providers.length) return null;
    const call = router.call({ messages: [{ role: "system", content: system }, { role: "user", content: input.question }], temperature: 0.3, maxTokens: 140 });
    const result = await Promise.race([call, new Promise<null>((resolve) => setTimeout(() => resolve(null), LATERAL_TIMEOUT_MS))]);
    if (!result) {
      void logAiUsage({ tenantId: input.tenantId, purpose: "lateral_answer", model: "timeout", startedAt, success: false, error: "timeout", conversationId: input.conversationId, leadId: input.leadId });
      return null;
    }
    model = result.model;
    const data = await result.response.json() as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } };
    const answer = sanitizeLateralAnswer(data.choices?.[0]?.message?.content);
    void logAiUsage({ tenantId: input.tenantId, purpose: "lateral_answer", model, startedAt, usage: data.usage, success: Boolean(answer), error: answer ? null : "refused_or_empty", conversationId: input.conversationId, leadId: input.leadId });
    return answer;
  } catch (error) {
    void import("./ai-usage-log").then(({ logAiUsage }) => logAiUsage({ tenantId: input.tenantId, purpose: "lateral_answer", model: model || "unknown", startedAt, success: false, error: error instanceof Error ? error.message : String((error as { errText?: string } | null)?.errText ?? "unknown_error"), conversationId: input.conversationId, leadId: input.leadId })).catch(() => undefined);
    console.warn("[qualification] lateral_answer_failed_open", { tenantId: input.tenantId, error: error instanceof Error ? error.message.slice(0, 160) : "unknown_error" });
    return null;
  }
}
