import type { AiMemoryUpdate } from "./ai-response-schema";
import { COLLECTIBLE_FIELDS, type ConversationMemory, type MemoryField } from "./memory";

/**
 * The model is only an interpreter here. It cannot choose a stage or write
 * arbitrary JSON into the conversation memory. This allow-list keeps the
 * qualification engine authoritative while still handling natural language,
 * spelling mistakes and answers that contain more than one fact.
 */
const FIELD_ALIASES: Record<string, keyof ConversationMemory> = {
  nome: "customerName",
  nomecompleto: "customerName",
  firstname: "customerFirstName",
  primeironome: "customerFirstName",
  cidade: "city",
  municipio: "city",
  estado: "state",
  uf: "state",
  idade: "age",
  idades: "age",
  datadenascimento: "birthDate",
  nascimento: "birthDate",
  tipodeplano: "planType",
  plano: "planType",
  plan: "planType",
  numerodevidas: "numberOfLives",
  vidas: "numberOfLives",
  pessoas: "numberOfLives",
  quantidade: "numberOfLives",
  quantidadedepessoas: "numberOfLives",
  email: "email",
  emaildecontato: "email",
  cnpj: "companyHasCnpj",
  empresacomcnpj: "companyHasCnpj",
  intencao: "intent",
  interesse: "intent",
};

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function canonicalField(field: string): keyof ConversationMemory | undefined {
  const key = normalize(field);
  return FIELD_ALIASES[key] ?? (COLLECTIBLE_FIELDS.some((candidate) => candidate.key === field) ? field as keyof ConversationMemory : undefined);
}

function canonicalValue(field: keyof ConversationMemory, raw: string): string | undefined {
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return undefined;
  const normalized = normalize(value);

  if (field === "planType") {
    if (/^(?:individual|pf|pessoafisica|paramim|soeu)$/.test(normalized)) return "individual";
    if (/^(?:familiar|familia|familiaridade|parafamilia|paraminhafamilia)$/.test(normalized)) return "familiar";
    if (/^(?:empresarial|pme|pj|pessoajuridica|paraempresa|paraminhaempresa|coletivo)$/.test(normalized)) return "empresarial";
    return undefined;
  }

  if (field === "numberOfLives") {
    const parseToken = (token: string) => {
      const numeric = Number(token);
      if (Number.isInteger(numeric) && numeric > 0 && numeric < 100) return numeric;
      return NUMBER_WORDS[normalize(token)];
    };
    const composition = value
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .match(/\b(\d+|[a-z]+)\s+adultos?\s*(?:e|,|mais)\s*(\d+|[a-z]+)\s+criancas?\b/i);
    if (composition) {
      const total = (parseToken(composition[1]) ?? 0) + (parseToken(composition[2]) ?? 0);
      if (total > 0 && total < 100) return String(total);
    }
    const digits = value.match(/\b([1-9]\d?)\b/);
    if (digits) return digits[1];
    const word = NUMBER_WORDS[normalized]
      ?? NUMBER_WORDS[value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(/\s+/).find((part) => NUMBER_WORDS[part]) ?? ""];
    return word ? String(word) : undefined;
  }

  if (field === "age") {
    const ages = value.match(/\b(?:[1-9]|[1-9]\d|1[0-4]\d)\b/g);
    return ages?.length ? ages.join(", ") : undefined;
  }

  if (field === "email") {
    const email = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
    return email?.toLowerCase();
  }

  if (field === "companyHasCnpj") {
    if (/^(?:sim|true|tenho|possuo|possui|tem)$/.test(normalized)) return "true";
    if (/^(?:nao|false|não)$/.test(normalized)) return "false";
    return undefined;
  }

  return value.slice(0, 200);
}

export type AppliedAiMemoryUpdate = {
  field: keyof ConversationMemory;
  value: string;
  confidence: 0 | 1;
};

/**
 * Decide when the model should interpret a turn in addition to the
 * deterministic extractor. Long answers and attachments deserve a fallback
 * pass even when one of the expected fields was recognized, because they can
 * contain facts for later stages as well.
 */
export function shouldUseQualificationFallback(input: {
  hasPendingQuestion: boolean;
  expectedWasAnswered: boolean;
  advancedToAnotherField: boolean;
  extractedFieldCount: number;
  messageLength: number;
  messageKind: string;
}) {
  if (!input.hasPendingQuestion) return false;
  const isComplexAnswer = input.messageLength >= 120 && input.extractedFieldCount < 2;
  const isAttachment = input.messageKind !== "text";
  return (!input.expectedWasAnswered && !input.advancedToAnotherField) || isComplexAnswer || isAttachment;
}

export function applyAiMemoryUpdates(
  memory: ConversationMemory,
  updates: AiMemoryUpdate[] | undefined,
  sourceMessageId?: string,
): { memory: ConversationMemory; applied: AppliedAiMemoryUpdate[] } {
  if (!updates?.length) return { memory, applied: [] };

  const next: ConversationMemory = { ...memory, collectedFields: [...memory.collectedFields] };
  const applied: AppliedAiMemoryUpdate[] = [];

  for (const update of updates) {
    const field = canonicalField(update.field);
    if (!field || field === "collectedFields" || field === "updatedAt" || field === "lastQuestionAsked" || field === "conversationSummary") continue;
    const value = canonicalValue(field, update.value);
    if (!value) continue;
    // Do not let a low-confidence guess advance a qualification stage. The
    // model must explicitly mark a fact as reliable before it is persisted.
    if (typeof update.confidence === "number" && update.confidence < 0.7) continue;
    const confidence = 1 as const;
    const current = next[field] as MemoryField | undefined;
    if (current?.value && current.confidence > confidence) continue;

    const fieldValue: MemoryField = { value, confidence, sourceMessageId };
    (next as Record<string, unknown>)[field] = fieldValue;
    if (!next.collectedFields.includes(field)) next.collectedFields.push(field);
    if (field === "customerName") {
      next.customerFirstName = { value: value.split(/\s+/)[0], confidence, sourceMessageId };
      if (!next.collectedFields.includes("customerName")) next.collectedFields.push("customerName");
    }
    applied.push({ field, value, confidence });
  }

  if (applied.length) next.updatedAt = new Date().toISOString();
  return { memory: next, applied };
}

export function buildQualificationFallbackPrompt(expectedField: string, expectedQuestion: string) {
  return `Você é um interpretador de respostas para uma qualificação de planos de saúde.\n` +
    `A pergunta pendente é sobre o campo "${expectedField}" e foi: "${expectedQuestion}".\n` +
    `Leia o histórico e a mensagem mais recente. Extraia somente fatos que o cliente realmente informou agora, ` +
    `inclusive se houver erro de digitação ou se ele responder em linguagem natural. Não invente valores. ` +
    `Uma única mensagem pode conter vários fatos; extraia todos os campos confiáveis de uma vez. ` +
    `Se a mensagem indicar uma imagem ou documento, registre apenas que o arquivo foi recebido e não invente seu conteúdo. ` +
    `Retorne memoryUpdates com os campos canônicos (customerName, planType, numberOfLives, age, city, email, ` +
    `companyHasCnpj ou intent), usando planType individual, familiar ou empresarial. ` +
    `Não escolha outra etapa, não repita a pergunta e não envie uma resposta livre: a aplicação escolherá a próxima pergunta. ` +
    `Se não houver informação confiável, retorne memoryUpdates vazio e confidence baixo.`;
}
