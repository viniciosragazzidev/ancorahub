import { z } from "zod";

import { companyEvidence, normalizeCompanyText } from "@/features/leads/company-lead-detection";
import { isCompanyDenial, type ConversationMemory, type MemoryField } from "./memory";
import { isGroundedInMessage } from "./qualification-fallback";
export { isQualificationContextAnalysisEnabled, qualificationContextAnalysisSettingKeys } from "./qualification-context-analysis-settings";

const CONFIDENCE_THRESHOLD = 0.75;
export const QUALIFICATION_CONTEXT_ANALYSIS_TIMEOUT_MS = 6_000;

const fieldNames = ["planType", "companyHasCnpj", "numberOfLives", "ages", "city", "currentPlan"] as const;
const intentNames = ["humanRequest", "noInterest", "priceQuestion", "customerQuestion"] as const;

export const qualificationContextAnalysisSchema = z.object({
  planType: z.enum(["individual", "familiar", "empresarial"]).nullable(),
  companyHasCnpj: z.boolean().nullable(),
  numberOfLives: z.number().int().min(1).max(99).nullable(),
  ages: z.array(z.number().int().min(0).max(120)).max(20),
  city: z.string().trim().min(1).max(120).nullable(),
  currentPlan: z.string().trim().min(1).max(120).nullable(),
  corrections: z.array(z.enum(["planType", "companyHasCnpj", "numberOfLives", "ages", "city", "currentPlan"])).max(6),
  answeredLastQuestion: z.boolean(),
  intents: z.object({
    humanRequest: z.boolean(),
    noInterest: z.boolean(),
    priceQuestion: z.boolean(),
    customerQuestion: z.boolean(),
  }).strict(),
  confidence: z.object({
    planType: z.number().min(0).max(1),
    companyHasCnpj: z.number().min(0).max(1),
    numberOfLives: z.number().min(0).max(1),
    ages: z.number().min(0).max(1),
    city: z.number().min(0).max(1),
    currentPlan: z.number().min(0).max(1),
    humanRequest: z.number().min(0).max(1),
    noInterest: z.number().min(0).max(1),
    priceQuestion: z.number().min(0).max(1),
    customerQuestion: z.number().min(0).max(1),
  }).strict(),
}).strict();

export type QualificationContextAnalysis = z.infer<typeof qualificationContextAnalysisSchema>;
export type ContextConversationMessage = { role: "system" | "user" | "assistant"; content: string };
export type ContextModelCallResult = {
  content: unknown;
  model: string;
  provider?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } | null;
};
export type ContextModelCall = (tenantId: string, messages: ContextConversationMessage[], signal: AbortSignal) => Promise<ContextModelCallResult>;

export type ContextAnalysisLogInput = {
  tenantId: string;
  conversationId: string;
  leadId: string;
  model: string;
  startedAt: number;
  status: "success" | "fallback";
  usage?: ContextModelCallResult["usage"];
  summary: string;
};

export type QualificationContextInput = {
  tenantId: string;
  conversationId: string;
  leadId: string;
  sourceMessageId?: string | null;
  currentMessage: string;
  previousQuestion: string;
  leadName?: string | null;
  messages: ContextConversationMessage[];
  /** Memory after the current turn's deterministic extractor has run. */
  memory: ConversationMemory;
  /** Memory persisted before this inbound, used to distinguish corrections from fresh values. */
  baseMemory: ConversationMemory;
};

export type ContextAnalysisDependencies = {
  callModel?: ContextModelCall;
  log?: (input: ContextAnalysisLogInput) => Promise<void> | void;
  timeoutMs?: number;
};

export type ContextAnalysisOutcome = {
  status: "success" | "fallback";
  analysis: QualificationContextAnalysis | null;
  memory: ConversationMemory;
  appliedFields: string[];
  model: string;
  intents: QualificationContextAnalysis["intents"] | null;
};

function normalized(value: string) {
  return normalizeCompanyText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function explicitCorrectionIn(message: string) {
  return /\b(?:na verdade|na real|corrig(?:i|indo)|errei|estava errado|me confundi|me enganei|quis dizer|queria dizer|ops)\b/i.test(message);
}

function hasPositiveCnpjEvidence(message: string) {
  if (isCompanyDenial(message)) return false;
  const normalizedMessage = normalized(message);
  const positiveCnpjMention = /\bcnpj\b/.test(normalizedMessage) && !/\b(?:nao|sem|nunca|nem)\s+(?:\w+\s+){0,2}cnpj\b/.test(normalizedMessage);
  return positiveCnpjMention || Boolean(companyEvidence(message));
}

function isGrounded(field: typeof fieldNames[number], value: string | number | boolean | number[], input: {
  message: string;
  previousQuestion: string;
  ages: number[];
}) {
  const message = input.message;
  const text = normalized(message);
  switch (field) {
    case "planType": {
      if (value === "empresarial") return Boolean(companyEvidence(message));
      if (value === "individual") return isGroundedInMessage("planType", value, message)
        || /\b(?:so|apenas|somente)\s+(?:meu|minha|pra mim|para mim|eu)\b|\b(?:pra mim|para mim)\b/.test(text);
      const hasFamilyEvidence = /\b(?:familia|familiar|marido|esposa|filh[oa]|dependente|conjuge|mae|pai|net[oa])\b/.test(text);
      const familyWasDenied = /\b(?:nao|sem|nunca)\s+(?:(?:e|quero|ser|sera)\s+)?(?:um\s+)?(?:plano\s+)?(?:familia|familiar)\b/.test(text);
      return hasFamilyEvidence && !familyWasDenied;
    }
    case "companyHasCnpj":
      return value === true ? hasPositiveCnpjEvidence(message) : isCompanyDenial(message);
    case "numberOfLives": {
      const count = Number(value);
      if (new RegExp(`\\b${count}\\s*(?:vidas?|pessoas?|beneficiari[oa]s?)\\b`, "i").test(message)) return true;
      if (new RegExp(`^\\s*${count}\\s*[.!]?\\s*$`).test(message) && /quantas vidas|quantas pessoas|quantidade de pessoas|beneficiari/i.test(input.previousQuestion)) return true;
      const inferredCount = input.ages.length;
      const hasMultiplePeople = /\b(?:eu|mim)\b/.test(text)
        && /\b(?:marido|esposa|filh[oa]|dependente|conjuge|mae|pai|net[oa])\b/.test(text);
      return count === inferredCount && inferredCount >= 2
        || count === 2 && hasMultiplePeople;
    }
    case "ages": {
      if (!Array.isArray(value) || value.length === 0) return false;
      const ageQuestion = /\b(?:idade|idades|anos)\b/i.test(input.previousQuestion);
      const ageMentioned = /\b(?:idade|idades|anos)\b/.test(text);
      const relationshipAndNumbers = /\b(?:pra mim|para mim|meu marido|minha esposa|meu filho|minha filha)\b/.test(text);
      return (ageQuestion || ageMentioned || relationshipAndNumbers)
        && value.every((age) => new RegExp(`(?<![0-9])${age}(?![0-9])`).test(message));
    }
    case "city":
      return isGroundedInMessage("city", String(value), message);
    case "currentPlan": {
      const key = normalized(String(value));
      return key.length >= 2 && text.includes(key);
    }
  }
}

function currentField(memory: ConversationMemory, field: "planType" | "companyHasCnpj" | "numberOfLives" | "age" | "city" | "currentPlan" | "averageAge") {
  return memory[field] as MemoryField | undefined;
}

function canApplyField(input: {
  field: "planType" | "companyHasCnpj" | "numberOfLives" | "age" | "city" | "currentPlan" | "averageAge";
  correctionField: QualificationContextAnalysis["corrections"][number];
  value: string;
  confidence: number;
  analysis: QualificationContextAnalysis;
  message: string;
  memory: ConversationMemory;
  baseMemory: ConversationMemory;
  sourceMessageId?: string | null;
  allowReplaceImpliedLives?: boolean;
  newValueGrounded?: boolean;
}) {
  if (input.confidence < CONFIDENCE_THRESHOLD) return false;
  const present = currentField(input.memory, input.field);
  if (present?.value === input.value) return false;
  const prior = currentField(input.baseMemory, input.field);
  if (prior?.value || present?.value) {
    const isImpliedLives = input.allowReplaceImpliedLives
      && (present?.confidence === 0 || prior?.confidence === 0)
      && !present?.confirmed && !prior?.confirmed;
    const correctionDeclared = input.analysis.corrections.includes(input.correctionField);
    const correctionSignal = explicitCorrectionIn(input.message) || input.newValueGrounded === true;
    if (!isImpliedLives && (!correctionDeclared || !correctionSignal)) return false;
  }
  return true;
}

function addCollected(memory: ConversationMemory, key: string) {
  if (!memory.collectedFields.includes(key)) memory.collectedFields.push(key);
}

export function mergeQualificationContextAnalysis(input: {
  memory: ConversationMemory;
  baseMemory: ConversationMemory;
  analysis: QualificationContextAnalysis;
  currentMessage: string;
  previousQuestion: string;
  sourceMessageId?: string | null;
}) {
  const memory: ConversationMemory = { ...input.memory, collectedFields: [...input.memory.collectedFields] };
  const applied = new Set<string>();
  const sourceMessageId = input.sourceMessageId ?? undefined;

  const proposedPlan = input.analysis.planType;
  if (proposedPlan && isGrounded("planType", proposedPlan, { message: input.currentMessage, previousQuestion: input.previousQuestion, ages: input.analysis.ages })) {
    if (canApplyField({ field: "planType", correctionField: "planType", value: proposedPlan, confidence: input.analysis.confidence.planType, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, newValueGrounded: true })) {
      memory.planType = { value: proposedPlan, confidence: 1, sourceMessageId };
      addCollected(memory, "planType");
      applied.add("planType");
    }
  }

  const cnpjValue = input.analysis.companyHasCnpj;
  if (cnpjValue !== null && isGrounded("companyHasCnpj", cnpjValue, { message: input.currentMessage, previousQuestion: input.previousQuestion, ages: input.analysis.ages })) {
    if (canApplyField({ field: "companyHasCnpj", correctionField: "companyHasCnpj", value: String(cnpjValue), confidence: input.analysis.confidence.companyHasCnpj, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, newValueGrounded: true })) {
      memory.companyHasCnpj = { value: String(cnpjValue), confidence: 1, sourceMessageId };
      addCollected(memory, "companyHasCnpj");
      applied.add("companyHasCnpj");
    }
  }

  const agesAreGrounded = isGrounded("ages", input.analysis.ages, {
    message: input.currentMessage,
    previousQuestion: input.previousQuestion,
    ages: input.analysis.ages,
  });
  const groundedAges = agesAreGrounded ? input.analysis.ages : [];
  if (groundedAges.length > 0) {
    const ageValue = groundedAges.join(", ");
    const canApplyAges = canApplyField({ field: "age", correctionField: "ages", value: ageValue, confidence: input.analysis.confidence.ages, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, newValueGrounded: true });
    const businessPlan = memory.planType?.value === "empresarial";
    const averageValue = String(Math.round(groundedAges.reduce((total, age) => total + age, 0) / groundedAges.length));
    const currentAverage = memory.averageAge?.value;
    const canApplyAverage = !businessPlan || currentAverage === averageValue || !currentAverage || canApplyField({ field: "averageAge", correctionField: "ages", value: averageValue, confidence: input.analysis.confidence.ages, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, newValueGrounded: true });
    if (canApplyAges && canApplyAverage) {
      memory.age = { value: ageValue, confidence: 1, sourceMessageId };
      if (businessPlan) memory.averageAge = { value: averageValue, confidence: 1, sourceMessageId };
      memory.beneficiaries = groundedAges.map((age) => ({ age, relation: null, sourceMessageId }));
      addCollected(memory, "age");
      applied.add("ages");
      if (businessPlan) applied.add("averageAge");
    }
  }

  const proposedLives = input.analysis.numberOfLives ?? (groundedAges.length >= 2 ? groundedAges.length : null);
  if (proposedLives !== null && isGrounded("numberOfLives", proposedLives, { message: input.currentMessage, previousQuestion: input.previousQuestion, ages: groundedAges })) {
    const confidence = input.analysis.numberOfLives === null ? input.analysis.confidence.ages : input.analysis.confidence.numberOfLives;
    if (canApplyField({ field: "numberOfLives", correctionField: "numberOfLives", value: String(proposedLives), confidence, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, allowReplaceImpliedLives: true, newValueGrounded: true })) {
      memory.numberOfLives = { value: String(proposedLives), confidence: 1, sourceMessageId };
      addCollected(memory, "numberOfLives");
      applied.add("numberOfLives");
    }
  }

  if (input.analysis.city && isGrounded("city", input.analysis.city, { message: input.currentMessage, previousQuestion: input.previousQuestion, ages: groundedAges })) {
    if (canApplyField({ field: "city", correctionField: "city", value: input.analysis.city, confidence: input.analysis.confidence.city, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, newValueGrounded: true })) {
      memory.city = { value: input.analysis.city, confidence: 1, sourceMessageId };
      addCollected(memory, "city");
      applied.add("city");
    }
  }

  if (input.analysis.currentPlan && isGrounded("currentPlan", input.analysis.currentPlan, { message: input.currentMessage, previousQuestion: input.previousQuestion, ages: groundedAges })) {
    if (canApplyField({ field: "currentPlan", correctionField: "currentPlan", value: input.analysis.currentPlan, confidence: input.analysis.confidence.currentPlan, analysis: input.analysis, message: input.currentMessage, memory, baseMemory: input.baseMemory, sourceMessageId, newValueGrounded: true })) {
      memory.currentPlan = { value: input.analysis.currentPlan, confidence: 1, sourceMessageId };
      applied.add("currentPlan");
    }
  }

  if (applied.size) memory.updatedAt = new Date().toISOString();
  return { memory, appliedFields: [...applied] };
}

const NAME_ACCENT_VARIANTS: Record<string, string> = {
  a: "aàáâãä",
  c: "cç",
  e: "eèéêë",
  i: "iìíîï",
  n: "nñ",
  o: "oòóôõö",
  u: "uùúûü",
  y: "yýÿ",
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function leadNamePattern(name: string) {
  return [...name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR")].map((character) => {
    if (/\s/u.test(character)) return "\\s+";
    const variants = NAME_ACCENT_VARIANTS[character];
    return variants ? `[${variants}]` : escapeRegExp(character);
  }).join("");
}

function redactLeadName(value: string, leadName?: string | null) {
  const normalizedName = leadName?.trim().replace(/\s+/g, " ");
  if (!normalizedName) return value;
  const names = [...new Set([normalizedName, normalizedName.split(" ")[0]].filter((name) => name.length >= 2))]
    .sort((left, right) => right.length - left.length);
  return names.reduce((text, name) => {
    const pattern = leadNamePattern(name);
    const expression = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{M}\\p{N}])`, "giu");
    return text.replace(expression, (_match, boundary: string) => `${boundary}[NOME]`);
  }, value);
}

/** Pure scrubber for personal identifiers and direct address details before provider input. */
export function redactQualificationContextText(value: string, leadName?: string | null) {
  const redactedDetails = value
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]")
    .replace(/\b\d{5}-?\d{3}\b/g, "[CEP]")
    .replace(/(?:\b(?:rua|avenida)\b|\br\.|\bav\.?)\s+[^,\n;]{1,100}(?:,\s*|\s+)(?:n[º°o.]?\s*)?\d{1,6}\b/giu, "[ENDEREÇO]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[E-MAIL]")
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}\b/g, "[TELEFONE]");
  return redactLeadName(redactedDetails, leadName);
}

function promptMemory(memory: ConversationMemory, leadName?: string | null) {
  const redact = (value?: string) => value ? redactQualificationContextText(value, leadName) : null;
  return {
    planType: memory.planType?.value ?? null,
    companyHasCnpj: memory.companyHasCnpj?.value === "true" ? true : memory.companyHasCnpj?.value === "false" ? false : null,
    numberOfLives: redact(memory.numberOfLives?.value),
    ages: redact(memory.age?.value ?? memory.averageAge?.value),
    city: redact(memory.city?.value),
    currentPlan: redact(memory.currentPlan?.value),
    lastQuestionAsked: redact(memory.lastQuestionAsked),
    collectedFields: memory.collectedFields,
  };
}

export function buildQualificationContextPrompt(input: Pick<QualificationContextInput, "messages" | "currentMessage" | "previousQuestion" | "memory" | "leadName">): ContextConversationMessage[] {
  const redact = (value: string) => redactQualificationContextText(value, input.leadName);
  const redactedCurrentMessage = redact(input.currentMessage).slice(0, 1_200);
  const recent = input.messages.slice(-12).map((message) => ({ role: message.role, content: redact(message.content).slice(0, 1_200) }));
  const currentAlreadyLast = recent.at(-1)?.role === "user" && recent.at(-1)?.content === redactedCurrentMessage;
  const chronological = currentAlreadyLast
    ? recent
    : [...recent, { role: "user" as const, content: redactedCurrentMessage }].slice(-12);
  const system = [
    "Você interpreta respostas da qualificação de planos de saúde. Não escreva nem sugira uma resposta ao cliente.",
    "Use apenas fatos que o cliente afirmou nas mensagens. A memória e perguntas anteriores são contexto, não prova de um fato novo.",
    "Marque uma correção se houver termo de correção ou um novo valor explícito para o mesmo campo. Um 'Não,' isolado não é correção.",
    "Uma negação como 'Não tenho CNPJ' significa companyHasCnpj=false e nunca plano empresarial. 'Só meu' ou 'Apenas pra mim' significa plano individual.",
    "Exemplo: 'CNPJ / Pra mim 70 / E meu marido 76' pode indicar empresarial, 2 vidas e idades [70,76].",
    "Responda somente com JSON válido, sem markdown. Valores desconhecidos devem ser null, ages deve ser [].",
    'Formato: {"planType":null,"companyHasCnpj":null,"numberOfLives":null,"ages":[],"city":null,"currentPlan":null,"corrections":[],"answeredLastQuestion":false,"intents":{"humanRequest":false,"noInterest":false,"priceQuestion":false,"customerQuestion":false},"confidence":{"planType":0.0,"companyHasCnpj":0.0,"numberOfLives":0.0,"ages":0.0,"city":0.0,"currentPlan":0.0,"humanRequest":0.0,"noInterest":0.0,"priceQuestion":0.0,"customerQuestion":0.0}}',
    "Em corrections liste somente campos que o cliente corrigiu explicitamente na mensagem atual.",
  ].join("\n");
  const context = {
    messages: chronological,
    lastQuestionAsked: redact(input.previousQuestion || input.memory.lastQuestionAsked || "") || null,
    memory: promptMemory(input.memory, input.leadName),
  };
  return [
    { role: "system", content: system },
    { role: "user", content: JSON.stringify(context) },
  ];
}

function extractContent(content: unknown): string | null {
  if (typeof content === "string") return content.trim();
  if (!content || typeof content !== "object") return null;
  const choices = (content as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const first = choices?.[0]?.message?.content;
  if (typeof first === "string") return first.trim();
  if (Array.isArray(first)) {
    return first.map((part) => part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text ?? "") : "").join("\n").trim();
  }
  return null;
}

export function parseQualificationContextResponse(content: unknown): QualificationContextAnalysis | null {
  const raw = extractContent(content);
  if (!raw) return null;
  const withoutFence = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed: unknown = JSON.parse(withoutFence);
    const validated = qualificationContextAnalysisSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

async function callGroqOrOpenRouter(tenantId: string, messages: ContextConversationMessage[], signal: AbortSignal): Promise<ContextModelCallResult> {
  const { createAiRouter } = await import("./model-router");
  const router = await createAiRouter(tenantId);
  if (signal.aborted) throw new Error("context_analysis_timeout");
  const result = await router.call({
    messages,
    responseFormat: { type: "json_object" },
    temperature: 0,
    maxTokens: 700,
    timeoutMs: QUALIFICATION_CONTEXT_ANALYSIS_TIMEOUT_MS,
    overallTimeoutMs: QUALIFICATION_CONTEXT_ANALYSIS_TIMEOUT_MS,
    signal,
  });
  const payload = await result.response.json().catch(() => null) as { usage?: ContextModelCallResult["usage"] } | null;
  return {
    content: payload,
    model: result.model,
    provider: result.provider,
    usage: payload?.usage ?? null,
  };
}

async function recordContextAnalysis(input: ContextAnalysisLogInput) {
  const { logAiUsage } = await import("./ai-usage-log");
  await logAiUsage({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    purpose: "qualification_context_analysis",
    model: input.model,
    startedAt: input.startedAt,
    usage: input.usage,
    success: input.status === "success",
    status: input.status,
    error: input.status === "fallback" ? "analysis_unavailable_or_invalid" : null,
    summary: input.summary,
  });
}

function safeSummary(analysis: QualificationContextAnalysis | null) {
  if (!analysis) return "fallback; fields=none";
  const fields = fieldNames.filter((field) => {
    if (field === "ages") return analysis.ages.length > 0;
    return analysis[field] !== null;
  });
  const corrections = [...analysis.corrections];
  const intents = intentNames.filter((intent) => analysis.intents[intent]);
  return `fields=${fields.join(",") || "none"}; corrections=${corrections.join(",") || "none"}; intents=${intents.join(",") || "none"}; answered=${analysis.answeredLastQuestion}`;
}

export async function analyzeAndMergeQualificationContext(
  input: QualificationContextInput,
  dependencies: ContextAnalysisDependencies = {},
): Promise<ContextAnalysisOutcome> {
  const startedAt = Date.now();
  const timeoutMs = Math.max(1, dependencies.timeoutMs ?? QUALIFICATION_CONTEXT_ANALYSIS_TIMEOUT_MS);
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let modelResult: ContextModelCallResult | undefined;
  let analysis: QualificationContextAnalysis | null = null;
  let status: ContextAnalysisOutcome["status"] = "fallback";
  let appliedFields: string[] = [];
  let memory = input.memory;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("context_analysis_timeout"));
      }, timeoutMs);
    });
    const callModel = dependencies.callModel ?? callGroqOrOpenRouter;
    modelResult = await Promise.race([callModel(input.tenantId, buildQualificationContextPrompt(input), controller.signal), timeout]);
    analysis = parseQualificationContextResponse(modelResult.content);
    if (!analysis) throw new Error("context_analysis_invalid_json");
    const merged = mergeQualificationContextAnalysis({
      memory: input.memory,
      baseMemory: input.baseMemory,
      analysis,
      currentMessage: input.currentMessage,
      previousQuestion: input.previousQuestion,
      sourceMessageId: input.sourceMessageId,
    });
    memory = merged.memory;
    appliedFields = merged.appliedFields;
    status = "success";
  } catch {
    // The extractor already ran; a failed analysis never blocks or erases its result.
    status = "fallback";
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const log = dependencies.log ?? recordContextAnalysis;
  void Promise.resolve(log({
    tenantId: input.tenantId,
    conversationId: input.conversationId,
    leadId: input.leadId,
    model: status === "success" ? `${modelResult?.provider ? `${modelResult.provider}/` : ""}${modelResult?.model ?? "unknown"}` : "fallback-rules",
    startedAt,
    status,
    usage: modelResult?.usage,
    summary: safeSummary(analysis),
  })).catch(() => undefined);

  return {
    status,
    analysis,
    memory,
    appliedFields,
    model: status === "success" ? `${modelResult?.provider ? `${modelResult.provider}/` : ""}${modelResult?.model ?? "unknown"}` : "fallback-rules",
    intents: analysis?.intents ?? null,
  };
}
