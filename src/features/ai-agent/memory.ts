import { companyEvidence } from "@/features/leads/company-lead-detection";
import { marketOperatorsInQuestion } from "@/features/operator-catalog/answer-guard";

/**
 * Phase 2 — Structured Conversation Memory
 *
 * Stores extracted customer data so the AI never asks for the same information
 * twice. The memory is persisted as a JSONB column on ai_conversations and is
 * rebuilt/extended on every turn.
 *
 * The AI prompt includes a block that lists all known fields so it can avoid
 * repeating questions. A post-generation guardrail detects repeated questions
 * and blocks them.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MemoryField = {
  value: string;
  /** 0=guessed, 1=explicitly provided */
  confidence: 0 | 1;
  /** The DB message ID that supplied this field */
  sourceMessageId?: string;
  /** Whether the customer confirmed this value */
  confirmed?: boolean;
};

export type BeneficiaryRelation = "titular" | "conjuge" | "filho" | "pai_mae" | "neto" | "outro";

export type ConversationBeneficiary = {
  age: number | null;
  relation: BeneficiaryRelation | null;
  relationText?: string;
  sourceMessageId?: string;
};

export type ConversationMemory = {
  customerName?: MemoryField;
  customerFirstName?: MemoryField;
  phone?: MemoryField;
  email?: MemoryField;
  city?: MemoryField;
  state?: MemoryField;
  age?: MemoryField;
  birthDate?: MemoryField;
  planType?: MemoryField;
  numberOfLives?: MemoryField;
  companyHasCnpj?: MemoryField;
  /** Aggregate workforce age for PME; never replaces individual ages for PF. */
  averageAge?: MemoryField;
  intent?: MemoryField;
  objections?: MemoryField;
  /** Asked together with the city ("Em qual cidade e bairro..."); never required. */
  neighborhood?: MemoryField;
  /** Whether the customer already has a health plan, and which ("Tem plano: Amil"); never required, never a decline. */
  currentPlan?: MemoryField;
  /** Ordered list of field keys that have been collected */
  collectedFields: string[];
  /** The last question the AI asked, verbatim */
  lastQuestionAsked?: string;
  /** Every question paragraph of the last reply (28/10): "cidade" can be asked before the last question. */
  lastQuestionsAsked?: string;
  /** Objection recoveries already tried (one, then a second refusal closes politely). */
  objectionAttempts?: number;
  /** Who the plan is for when it is not the person talking ("filha", "pai"). */
  beneficiaryRelation?: string;
  /** Optional relationship details, kept outside collectedFields so qualification never waits for them. */
  beneficiaries?: ConversationBeneficiary[];
  beneficiaryRaw?: string;
  relationAsked?: boolean;
  /** Short free-text summary of the conversation so far */
  conversationSummary?: string;
  /** ISO timestamp of last update */
  updatedAt?: string;
};

/** All fields that can be collected, in priority order. */
export const COLLECTIBLE_FIELDS: Array<{
  key: keyof ConversationMemory;
  label: string;
  promptLabel: string;
}> = [
  { key: "customerName", label: "Nome completo", promptLabel: "nome completo" },
  { key: "city", label: "Cidade", promptLabel: "cidade" },
  { key: "planType", label: "Tipo de plano", promptLabel: "tipo de plano (individual, familiar, empresarial)" },
  { key: "numberOfLives", label: "Número de vidas", promptLabel: "quantidade de pessoas" },
  { key: "age", label: "Idade", promptLabel: "idade" },
  { key: "email", label: "E-mail", promptLabel: "e-mail" },
  { key: "companyHasCnpj", label: "Empresa com CNPJ", promptLabel: "se a empresa tem CNPJ" },
  { key: "intent", label: "Intenção", promptLabel: "intenção" },
];

// ─── Field extraction patterns (Portuguese-first) ────────────────────────────

const NAME_PATTERNS = [
  /(?:meu nome é|me chamo|sou o|sou a|eu sou|eu me chamo|chamo-me)\s+([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
  /(?:é o|é a)\s+([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+)/i,
  /^([A-ZÀ-Ú][a-zà-ú]+\s+[A-ZÀ-Ú][a-zà-ú]+)/,
];

const CITY_PATTERNS = [
  // Covers neighbourhoods and multi-word locations such as
  // "moramos no Recreio dos Bandeirantes" without swallowing the rest of
  // the sentence. The explicit location introducers make this safe for long
  // free-text answers.
  /(?:moro|moramos|resido|residimos)\s+(?:em|no|na)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:d[aeo]s?|[A-ZÀ-Ú][a-zà-ú]+)){0,5})/i,
  /(?:moro em|sou de|na cidade de|localizado em|fica em)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
  /cidade\s*(?:é|:)?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
];

const PLAN_TYPE_PATTERNS = [
  /\bpessoa\s+f(?:ísica|fisica)\b/i,
  /\bpessoa\s+j(?:urídica|uridica)\b/i,
  /\b(?:individual|PF|para mim|sou eu|só para mim)\b/i,
  /\b(?:familiar|para família|para minha família)\b/i,
  /\b(?:empresarial|PME|PJ|MEI|para empresa|para minha empresa|coletivo)\b/i,
];

// "para N" alone is not a quantity ("Para 12, 42 anos" are two ages): it only
// counts next to pessoas/vidas, or as the answer to the lives question.
const NUMBER_OF_LIVES_PATTERNS = [
  /(\d+)\s*(?:pessoas?|vidas?|familiares?|dependentes?|pessoal|integrantes?)/i,
  /(?:somos|sou|minha família tem|seria para|apenas)\s*(\d+)/i,
  /para\s*(\d+)\s*(?:pessoas?|vidas?)/i,
];

/**
 * The ages in a message that talks about ages ("Para 12 , 42 anos", "12anos e
 * 42 anos", "30 e 32 anos"): every number of the message except one that
 * counts people ("2 vidas"). Empty when the message does not mention "anos".
 */
/**
 * A message where the customer only talks about their own age ("tenho 63 anos ...
 * tenho 63 anos") is one person, even when the age is repeated (case Edivaldo,
 * 21/10: read as "2 pessoas, 63 e 63"). Null when anyone else is mentioned.
 */
export function readSelfOnlyAge(message: string): number | null {
  const normalized = normalizeForMatching(message);
  const selfAges = Array.from(normalized.matchAll(/\b(?:tenho|eu tenho|minha idade (?:e|eh|sao)|estou com|to com|tou com)\s*(\d{1,3})\s*a?nos?\b/g))
    .map((match) => Number(match[1]))
    .filter((age) => age > 0 && age <= 120);
  if (!selfAges.length) return null;
  const mentionsOthers = /\b(?:filh|espos|marid|mulher|mae|pai|irma|irmao|avo|net[ao]|sobrinh|sogr|entead|dependente|familia|pessoas|vidas|casal|socio|funcionari|colaborador)|\beu e\b|\bnos (?:dois|duas|tres)\b/.test(normalized);
  if (mentionsOthers) return null;
  // Every number next to "anos" must be the same self age (a second, different age is someone else).
  const allAges = Array.from(normalized.matchAll(/\b(\d{1,3})\s*a?nos?\b/g)).map((match) => Number(match[1]));
  return allAges.every((age) => age === selfAges[0]) ? selfAges[0] : null;
}

/** Words every wording of the "already has a plan" question carries (reply-composer.ts). */
export const CURRENT_PLAN_MARKER = "plano de saude hoje";

export function asksCurrentPlan(question: string | null | undefined) {
  return normalizeForMatching(question ?? "").includes(CURRENT_PLAN_MARKER);
}

/**
 * The answer to "vocês já têm plano de saúde hoje?": "Não tem plano", "Tem plano: Amil" or
 * "Tem plano". Null when the message does not say (an e-mail alone, for instance).
 * It is information for the broker: "já tenho Amil" here is never a decline.
 */
export function readCurrentPlan(message: string): string | null {
  const text = normalizeForMatching(message).replace(/[^a-z0-9@.\s]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const operators = marketOperatorsInQuestion(message);
  if (operators.length) return `Tem plano: ${operators.join(", ")}`;
  if (/e-?mail|@/.test(text) && !/\bplano\b/.test(text)) return null;
  if (/^(nao|n|nenhum|nenhuma)( (tenho|temos|possuo|nenhum|nenhuma|ainda))*( nao)?$|\bnao (tenho|temos|tem|possuo|possuimos|uso|usamos)( plano| nenhum| convenio)?$|\bnao (tenho|temos|possuo|possuimos) (plano|nenhum|convenio)\b|\bnenhum plano\b|\bsem plano\b|\bnao temos nenhum\b/.test(text)) return "Não tem plano";
  if (/^(sim|s|tenho|temos|tem|possuo|uso|usamos)\b|\b(tenho|temos|possuo|usamos|uso) (plano|o plano|um plano|convenio)\b/.test(text)) return "Tem plano";
  return null;
}

/** The neighbourhood in an answer to "cidade e bairro": "Niterói, Icaraí", "Icaraí - Niterói", "bairro Icaraí". */
export function readNeighborhood(message: string, city: string): string | null {
  const cityKey = normalizeForMatching(city).trim();
  const clean = (value: string) => value
    .replace(/^(?:(?:eu )?(?:moro|fico|sou|resido)\s+)?(?:no bairro|bairro|no|na|em|de|do|da)\s+/i, "")
    .replace(/\s*[-/]?\s*\b(?:rj|sp|mg|es|ba|pr|sc|rs|df|go)\b\.?$/i, "")
    .trim();
  const valid = (value: string) => value.length >= 2 && value.length <= 40 && /\p{L}/u.test(value) && !/\d/.test(value)
    && value.split(/\s+/).length <= 4 && !/^(sim|nao|não|ok|centro da cidade)$/i.test(value)
    && normalizeForMatching(value).trim() !== cityKey;
  const named = message.match(/bairro\s+(?:d[aeo]\s+)?([^\n,.;!?]{2,40})/i)?.[1];
  if (named) {
    const value = clean(named);
    return valid(value) ? value : null;
  }
  const parts = message.split(/[,;\n]|\s[-–/]\s/).map((part) => clean(part.trim())).filter(Boolean);
  if (parts.length < 2) return null;
  const other = parts.find((part) => !normalizeForMatching(part).includes(cityKey) && !cityKey.includes(normalizeForMatching(part).trim()));
  return other && valid(other) ? other : null;
}

/**
 * Enough to quote: the plan type, the lives and the ages (the average age for a company).
 * From here the lead is hot even if the rest (city, e-mail) never comes (Vinicios, 23/10).
 */
export function hasCoreQuoteData(memory: ConversationMemory | null | undefined) {
  const plan = memory?.planType?.value;
  if (!plan) return false;
  const lives = Number.parseInt(memory?.numberOfLives?.value ?? "", 10);
  const hasLives = (Number.isInteger(lives) && lives > 0) || plan === "individual";
  const hasAges = plan === "empresarial" ? Boolean(memory?.averageAge?.value?.trim()) : Boolean(memory?.age?.value?.trim());
  return hasLives && hasAges;
}

/**
 * Hot needs the quote data AND the city (28/10, Vinicios): the broker gets the lead with the
 * location already known. The timeout uses the same criterion, so a lead that stops still
 * goes to the queue, only as warm.
 */
export function hasQuoteReadyData(memory: ConversationMemory | null | undefined) {
  return hasCoreQuoteData(memory) && Boolean(memory?.city?.value?.trim());
}

export function readAgeList(message: string): number[] {
  // "17.16.49.48" (case Eliane, 27/10): short numbers joined by dots are a list, never money
  // (money groups thousands in 3 digits: "4.500").
  const normalized = normalizeForMatching(message).replace(/(\b\d{1,3})\.(?=\d{1,2}\b)/g, "$1, ");
  // A message that is only a list of numbers ("17, 18, 49, 48", "as idades 30 e 25") is the ages,
  // even without the word "anos": that is how people answer "Digite sua idade".
  const onlyNumbers = /^(?:as\s+)?(?:idades?\s*:?\s*)?\d{1,3}(?:\s*(?:,|;|\/|\be\b)\s*\d{1,3}|\s+\d{1,3})+\s*[.!]?$/.test(normalized.trim());
  if (!onlyNumbers && !/\d\s*a?nos?\b|\banos?\b|\bidades?\b/.test(normalized)) return [];
  const selfAge = readSelfOnlyAge(message);
  if (selfAge !== null) return [selfAge];
  const withoutPeople = normalized.replace(/\b\d{1,3}\s*(?:pessoas?|vidas?|familiares?|dependentes?|integrantes?|beneficiari[oa]s?)\b/g, " ");
  // Numbers that are not ages (case Maria Tereza, 23/10: "Amil Opções 22 ... 4.500, 00 ... 50% da
  // aposentadoria" became the ages 22, 4 and 50): money, percentages, plan codes, addresses.
  const withoutNoise = withoutPeople
    .replace(/r\$\s*[\d.,\s]*\d/g, " ")
    .replace(/\b\d{1,3}(?:\.\d{3})+(?:\s*,\s*\d{1,2})?/g, " ")
    .replace(/\b\d+\s*,\s*\d{2}\s*(?:reais|por mes|mensais|mensal)\b/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:%|por ?cento)/g, " ")
    .replace(/\b(?:opcoes|opcao|plano|tabela|codigo|cod|numero|apto|apartamento|rua|casa|lote|bloco|quadra|sala)\s*\d+/g, " ");
  // A list right before "anos" ("( 75 e 71 anos )", "12, 42 anos") is the ages: the other
  // numbers of a long message are left out.
  const anchored = Array.from(withoutNoise.matchAll(/((?:\b\d{1,3}\s*(?:,|;|\/|\be\b|\s)\s*)*\b\d{1,3})\s*a?nos?\b/g))
    .flatMap((match) => Array.from(match[1]!.matchAll(/\d{1,3}/g)).map((item) => Number(item[0])));
  if (anchored.length >= 2) return anchored.filter((age) => age >= 0 && age <= 120);
  return Array.from(withoutNoise.matchAll(/(?<![\d@.])(\d{1,3})(?![\d@])/g))
    .map((match) => Number(match[1]))
    .filter((age) => age >= 0 && age <= 120);
}

const NUMBER_WORD_VALUES: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezassete: 17,
  dezoito: 18,
  dezenove: 19,
  dezanove: 19,
  vinte: 20,
};
const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORD_VALUES).join("|");

// Words around a quantity that do not change it: "pode ser 1", "seria 2",
// "umas 3", "acho que 4", "3 por enquanto".
const LIVES_LEADING_FILLER = /^(?:e|entao|bom|olha|ah|hum|sim|acho que|creio que|pode ser|podem ser|pode colocar|coloca|coloque|pode por|seria|seriam|sera|serao|vai ser|vao ser|sao|e de|somos|seremos|temos|tenho|teremos|para|pra|por enquanto|inicialmente|no momento|a principio|so|apenas|somente|umas?|uns|cerca de|aproximadamente|mais ou menos|em torno de|tipo|no total|total de|total)\s+/;
const LIVES_TRAILING_FILLER = /\s+(?:so|apenas|somente|por enquanto|no momento|mesmo|inicialmente|mais ou menos|aproximadamente|no total|ao todo|por ai|vidas?|pessoas?|funcionarios?|socios?|colaboradores?|beneficiari[oa]s?|integrantes?|dependentes?|familiares?)$/;

function livesNumberToken(token: string): number | undefined {
  const numeric = Number(token);
  if (/^\d+$/.test(token) && Number.isInteger(numeric) && numeric > 0 && numeric < 100) return numeric;
  return NUMBER_WORD_VALUES[token];
}

/**
 * The question part of a reply: its last paragraph. Replies may carry a
 * greeting or a lateral answer before the question ("O valor depende da
 * idade... / Quantas vidas...?"); reading the next answer against that text
 * would take "a partir de 59 é 529,47" as ages.
 */
export function pendingQuestionOf(reply: string) {
  const paragraphs = reply.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  return paragraphs[paragraphs.length - 1] ?? reply.trim();
}

/**
 * Every question paragraph of a reply (28/10). A reply can ask the city and then the plan in two
 * paragraphs: only the last one would be "the question", so the city answer was never read.
 * Lateral paragraphs without "?" stay out, as in pendingQuestionOf.
 */
export function pendingQuestionsOf(reply: string) {
  const questions = reply.split(/\n\s*\n/).map((part) => part.trim()).filter((part) => part.includes("?"));
  return questions.length ? questions.join("\n") : pendingQuestionOf(reply);
}

/** The text of the question(s) the AI asked last: the last one plus every question of the last reply. */
function pendingQuestionsText(memory: ConversationMemory) {
  return `${memory.lastQuestionAsked ?? ""} ${memory.lastQuestionsAsked ?? ""}`;
}

/**
 * A short answer to the lives question, read in its context: "pode ser 1",
 * "só 1", "1 pessoa", "somente eu", "eu e minha esposa", "umas 3", "três",
 * "seria 2". Only call it when the pending question asks for the number of
 * lives: out of context "seria 2" or "eu e minha esposa" are not quantities.
 * Undefined when the answer is not clearly a quantity (e.g. "eu e meus
 * filhos", where the count is unknown).
 */
export function readLivesAnswer(message: string): number | undefined {
  let text = normalizeForMatching(message).replace(/[.!?;]+/g, " ").replace(/\s+/g, " ").trim();
  for (let guard = 0; guard < 6; guard += 1) {
    const next = text.replace(LIVES_LEADING_FILLER, "").replace(LIVES_TRAILING_FILLER, "").trim();
    if (next === text) break;
    text = next;
  }
  if (!text) return undefined;

  const bare = text.match(new RegExp(`^(\\d{1,2}|${NUMBER_WORD_PATTERN})$`));
  if (bare?.[1]) return livesNumberToken(bare[1]);

  if (/^(?:eu|eu mesm[oa]|eu sozinh[oa]|sozinh[oa]|minha pessoa|mim|pra mim|para mim)$/.test(text)) return 1;

  // "eu e minha esposa", "eu, minha esposa e meu filho", "eu e meus 2 filhos".
  if (/^eu\s*(?:,|\be\b|\bmais\b)/.test(text)) {
    const parts = text.split(/\s*(?:,|\be\b|\bmais\b)\s*/).map((part) => part.trim()).filter(Boolean);
    let total = 0;
    for (const part of parts) {
      if (part === "eu") { total += 1; continue; }
      const words = part.split(" ");
      if (words.length > 4) return undefined;
      const counted = words.map((word) => livesNumberToken(word)).find((value) => value !== undefined);
      if (counted !== undefined) { total += counted; continue; }
      // A plural without a number ("meus filhos") is an unknown count.
      if (/^(?:meus|minhas|os|as)\b/.test(part) || /s$/.test(words[words.length - 1] ?? "")) return undefined;
      total += 1;
    }
    return total > 0 && total < 100 ? total : undefined;
  }
  return undefined;
}

const AGE_PATTERNS = [
  /(\d+)\s*(?:anos|anos de idade)/i,
  /(?:tenho|idade)\s*(\d+)/i,
  /(\d+)\s*anos/i,
];

const EMAIL_PATTERNS = [
  /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
];

const CNPJ_PATTERNS = [
  /\b(sim|tenho|possui|tem)\b.*\b(cnpj|empresa|pj)/i,
  /\b(cnpj|empresa|pj)\b.*\b(sim|tenho|possui|tem)/i,
];

export function hasPositiveCnpjEvidence(message: string): boolean {
  return message.split(/[.!?\n]+/).some((sentence) =>
    /\bcnpj\b/i.test(sentence) && companyEvidence(sentence)?.toLowerCase() === "cnpj",
  );
}

const INTENT_PATTERNS = [
  /(?:gostaria|gostaríamos|queremos|quero|busco|procuro)\s+(?:de\s+)?(?:ver|conhecer|receber|encontrar)\s+([^.!?\n]+)/i,
  /(?:quero|gostaria|preciso de|estou atrás de|busco|procuro)\s+(?:um|uma|de|contratar|saber)\s+([^,.!?]+)/i,
  /(?:cotação|preço|valor|quanto custa|orçamento)/i,
];

const qualificationOrder: Array<keyof ConversationMemory> = [
  "customerName", "planType", "numberOfLives", "age", "city", "email",
  "companyHasCnpj", "intent",
];
const fieldsByKey = new Map(COLLECTIBLE_FIELDS.map((field) => [field.key, field]));
COLLECTIBLE_FIELDS.splice(
  0,
  COLLECTIBLE_FIELDS.length,
  ...qualificationOrder.flatMap((key) => {
    const field = fieldsByKey.get(key);
    return field ? [field] : [];
  }),
);

export const CORE_QUALIFICATION_FIELDS: Array<"customerName" | "planType" | "numberOfLives" | "age" | "city" | "email"> = [
  "customerName", "planType", "numberOfLives", "age", "city", "email",
];

export function isCoreQualificationComplete(memory: ConversationMemory): boolean {
  return CORE_QUALIFICATION_FIELDS.every((field) =>
    field === "age" && memory.planType?.value === "empresarial"
      ? Boolean(memory.averageAge?.value)
      : Boolean(memory[field]?.value),
  );
}

/** Stored when the customer declines to give an e-mail; never saved on the lead (no "@"). */
export const EMAIL_DECLINED = "não informado";

function normalizeForMatching(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Extract fields from a user message, updating existing memory.
 * Returns the merged memory with any new fields.
 */
export function extractFieldsFromMessage(
  message: string,
  existingMemory: ConversationMemory,
  sourceMessageId?: string,
): ConversationMemory {
  const memory: ConversationMemory = {
    ...existingMemory,
    collectedFields: [...existingMemory.collectedFields],
  };

  const trimmed = message.trim();
  const hasCompanyEvidence = Boolean(companyEvidence(trimmed));
  const hasCnpjEvidence = hasPositiveCnpjEvidence(trimmed);
  const isNameQuestion = /\bnome\b|como voce se chama|quem e voce/.test(
    normalizeForMatching(memory.lastQuestionAsked ?? ""),
  );

  // Name extraction
  if (!memory.customerName) {
    for (const [index, pattern] of NAME_PATTERNS.entries()) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const name = match[1].trim();
        const firstNameToken = normalizeForMatching(name.split(/\s+/)[0] ?? "");
        if (
          (index < 2 || isNameQuestion)
          && name.length >= 5
          && name.includes(" ")
          && !NON_NAME_PREFIXES.has(firstNameToken)
        ) {
          memory.customerName = { value: name, confidence: 1, sourceMessageId };
          memory.customerFirstName = {
            value: name.split(" ")[0],
            confidence: 1,
            sourceMessageId,
          };
          addCollectedField(memory, "customerName");
          break;
        }
      }
    }
  }

  // If no full name, check if message is just "first name" (single word + context)
  if (!memory.customerName && trimmed.length > 0) {
    const isJustName = /^[A-ZÀ-Ú][a-zà-ú]+$/.test(trimmed) && trimmed.length >= 2 && !commonWords.has(trimmed.toLowerCase());
    if (isJustName && /\s/.test(trimmed)) {
      // Only treat as name if message is short (likely first interaction)
      memory.customerFirstName = {
        value: trimmed,
        confidence: 1,
        sourceMessageId,
      };
      memory.customerName = { value: trimmed, confidence: 0, sourceMessageId };
      addCollectedField(memory, "customerName");
    }
  }

  // City extraction
  if (!memory.city) {
    for (const pattern of CITY_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const city = match[1].trim();
        if (isLikelyCityAnswer(city)) {
          memory.city = { value: city, confidence: 1, sourceMessageId };
          addCollectedField(memory, "city");
          break;
        }
      }
    }

    const asksForCity = normalizeForMatching(pendingQuestionsText(memory)).includes("cidade");
    // A city answer may include a neighbourhood/region after a comma, slash or dash
    // ("Rio de Janeiro, centro", "Petrópolis/RJ", "Petrópolis - RJ"). Keep the city segment only.
    const bareCity = trimmed.split(/[,;/]|\s[-–]\s/)[0]?.trim() ?? "";
    if (!memory.city && asksForCity && isLikelyCityAnswer(bareCity)) {
      memory.city = { value: bareCity, confidence: 1, sourceMessageId };
      addCollectedField(memory, "city");
    }
  }

  // The city question also asks the neighbourhood (23/10): "Niterói, Icaraí" or "bairro Icaraí".
  if (!memory.neighborhood && memory.city?.value && normalizeForMatching(pendingQuestionsText(memory)).includes("bairro")) {
    const neighborhood = readNeighborhood(trimmed, memory.city.value);
    if (neighborhood) memory.neighborhood = { value: neighborhood, confidence: 1, sourceMessageId };
  }

  // The last question also asks whether the customer already has a plan: any clear answer is kept.
  if (!memory.currentPlan && asksCurrentPlan(memory.lastQuestionAsked)) {
    const currentPlan = readCurrentPlan(trimmed);
    if (currentPlan) memory.currentPlan = { value: currentPlan, confidence: 1, sourceMessageId };
  }

  // Positive company evidence overrides a previously stated individual/family
  // plan because it changes which qualification flow the lead needs.
  if (hasCompanyEvidence && memory.planType?.value !== "empresarial") {
    memory.planType = { value: "empresarial", confidence: 1, sourceMessageId };
    addCollectedField(memory, "planType");
    if (memory.numberOfLives?.confidence === 0) {
      delete memory.numberOfLives;
      memory.collectedFields = memory.collectedFields.filter((field) => field !== "numberOfLives");
    }
  }

  // A plan for a relative: "pra minha filha" is an individual plan for one other person;
  // "eu e minha filha" is a family plan (case Adelair, 21/10).
  if (!memory.planType) {
    const normalizedRelative = normalizeForMatching(trimmed);
    const relative = normalizedRelative.match(/\b(?:para|pra|pro|p\/)\s+(?:as?\s+|os?\s+)?(?:minha|meu|minhas|meus)\s+(filha|filho|filhas|filhos|mae|pai|esposa|marido|mulher|namorada|namorado|irma|irmao|avo|neta|neto|sobrinha|sobrinho|sogra|sogro|enteada|enteado)\b/);
    const withSelf = /\b(?:pra mim e|para mim e|eu e (?:a |o )?(?:minha|meu))\b/.test(normalizedRelative);
    if (withSelf) {
      memory.planType = { value: "familiar", confidence: 1, sourceMessageId };
      addCollectedField(memory, "planType");
    } else if (relative && !/s$/.test(relative[1])) {
      memory.planType = { value: "individual", confidence: 1, sourceMessageId };
      memory.beneficiaryRelation = relative[1];
      addCollectedField(memory, "planType");
    } else if (relative) {
      memory.planType = { value: "familiar", confidence: 1, sourceMessageId };
      memory.beneficiaryRelation = relative[1];
      addCollectedField(memory, "planType");
    }
  }

  // Plan type extraction
  if (!memory.planType) {
    const normalizedPlanMessage = normalizeForMatching(trimmed);
    for (const pattern of PLAN_TYPE_PATTERNS) {
      if (pattern.test(trimmed) || pattern.test(normalizedPlanMessage) || /\b(?:individual|familiar|familia|empresarial|empresa|mei|pme|pf|pj)\b/i.test(normalizedPlanMessage)) {
        const value =
          /pessoa\s+f(?:isica)/i.test(normalizedPlanMessage)
            ? "individual"
            : /pessoa\s+j(?:uridica)/i.test(normalizedPlanMessage)
              ? "empresarial"
              : /individual|\bpf\b|para mim|sou eu|so para mim/i.test(normalizedPlanMessage)
                ? "individual"
              : /familiar|familia|para minha familia/i.test(normalizedPlanMessage)
                ? "familiar"
                : "empresarial";
        memory.planType = { value, confidence: 1, sourceMessageId };
        addCollectedField(memory, "planType");
        break;
      }
    }
  }

  // An individual plan covers one person: the lives question is skipped. The
  // confidence 0 marks it as implied, not said, so replies do not echo it.
  if (memory.planType?.value === "individual" && !memory.numberOfLives) {
    memory.numberOfLives = { value: "1", confidence: 0, sourceMessageId: memory.planType.sourceMessageId };
    addCollectedField(memory, "numberOfLives");
  }

  // Number of lives
  if (!memory.numberOfLives) {
    const normalizedMessage = normalizeForMatching(trimmed).replace(/\s+/g, " ").trim();
    const numberToken = (token: string) => {
      const numeric = Number(token);
      if (Number.isInteger(numeric) && numeric > 0 && numeric < 100) return numeric;
      return NUMBER_WORD_VALUES[normalizeForMatching(token)];
    };
    const composition = normalizedMessage.match(/\b(\d+|[a-z]+)\s+adultos?\s*(?:e|,|mais)\s*(\d+|[a-z]+)\s+criancas?\b/i);
    const compositionValue = composition ? (numberToken(composition[1]) ?? 0) + (numberToken(composition[2]) ?? 0) : 0;
    if (compositionValue > 0 && compositionValue < 100) {
      memory.numberOfLives = { value: String(compositionValue), confidence: 1, sourceMessageId };
      addCollectedField(memory, "numberOfLives");
    }

    const bareNumber = trimmed.match(/^([1-9]\d?)$/);
    if (!memory.numberOfLives && bareNumber && /quantas vidas|quantas pessoas|quantidade de pessoas|n[úu]mero de vidas/i.test(memory.lastQuestionAsked ?? "")) {
      memory.numberOfLives = { value: bareNumber[1], confidence: 1, sourceMessageId };
      addCollectedField(memory, "numberOfLives");
    }

    // Short answers frequently use Portuguese number words ("só uma",
    // "uma pessoa", "duas vidas"). Resolve them only in the context of a
    // lives question so ordinary prose is not mistaken for a quantity.
    if (!memory.numberOfLives) {
      const normalizedQuestion = normalizeForMatching(memory.lastQuestionAsked ?? "");
      const asksForLives = /quantas vidas|quantas pessoas|quantidade de pessoas|numero de vidas|beneficiari/.test(normalizedQuestion);
      const livesWordPattern = new RegExp(
        `^(?:e\\s+)?(?:(?:so|apenas|somente)\\s+)?(${NUMBER_WORD_PATTERN})(?:\\s+(?:pessoas?|vidas?|familiares?|dependentes?|pessoal|integrantes?))?$`,
        "i",
      );
      const livesPhrasePattern = new RegExp(
        `^(?:somos|seria para|sou|temos|tenho|para|minha familia tem)\\s+(?:(?:so|apenas|somente)\\s+)?(${NUMBER_WORD_PATTERN})(?:\\s+(?:pessoas?|vidas?|familiares?|dependentes?|pessoal|integrantes?))?$`,
        "i",
      );
      const wordMatch = (asksForLives ? normalizedMessage.match(livesWordPattern) : null)
        ?? normalizedMessage.match(livesPhrasePattern);
      const parsedWordValue = wordMatch?.[1] ? NUMBER_WORD_VALUES[normalizeForMatching(wordMatch[1])] : undefined;
      if (parsedWordValue && parsedWordValue > 0 && parsedWordValue < 100) {
        memory.numberOfLives = { value: String(parsedWordValue), confidence: 1, sourceMessageId };
        addCollectedField(memory, "numberOfLives");
      }
    }

    // A quantity next to "vida(s)/pessoa(s)" anywhere in the sentence ("plano
    // pra uma vida no MEI", "quero ta uma vida"), and short replies to the
    // lives question with the word after the number ("uma só") or meaning one
    // person ("só eu", "sozinha").
    if (!memory.numberOfLives) {
      const normalizedQuestion = normalizeForMatching(memory.lastQuestionAsked ?? "");
      const asksForLives = /quantas vidas|quantas pessoas|quantidade de pessoas|numero de vidas|beneficiari/.test(normalizedQuestion);
      const inSentence = normalizedMessage.match(new RegExp(`\\b(\\d{1,2}|${NUMBER_WORD_PATTERN})\\s+(?:pessoas?|vidas?|beneficiari[oa]s?)\\b`, "i"));
      const shortReply = asksForLives
        ? normalizedMessage.match(new RegExp(`^(?:e\\s+)?(\\d{1,2}|${NUMBER_WORD_PATTERN})\\s+(?:so|apenas|somente)$`, "i"))
        : null;
      const onlyMe = asksForLives && /^(?:(?:e\s+)?(?:so|apenas|somente)\s+(?:eu|pra mim|para mim)|eu mesm[oa]|sozinh[oa]|so minha pessoa)$/.test(normalizedMessage);
      const token = inSentence?.[1] ?? shortReply?.[1];
      const value = onlyMe ? 1 : token ? numberToken(token) : undefined;
      if (value && value > 0 && value < 100) {
        memory.numberOfLives = { value: String(value), confidence: 1, sourceMessageId };
        addCollectedField(memory, "numberOfLives");
      }
    }

    // Any other short answer to the lives question: "pode ser 1", "seria 2",
    // "umas 3", "eu e minha esposa".
    if (!memory.numberOfLives && /quantas vidas|quantas pessoas|quantidade de pessoas|numero de vidas|beneficiari/.test(normalizeForMatching(memory.lastQuestionAsked ?? ""))) {
      const contextual = readLivesAnswer(trimmed);
      if (contextual) {
        memory.numberOfLives = { value: String(contextual), confidence: 1, sourceMessageId };
        addCollectedField(memory, "numberOfLives");
      }
    }

    // Several ages in one answer are the people of the plan: "12 e 42 anos" is 2 lives.
    const listedAges = readAgeList(trimmed);
    if (!memory.numberOfLives && listedAges.length >= 2 && listedAges.length < 100) {
      memory.numberOfLives = { value: String(listedAges.length), confidence: 1, sourceMessageId };
      addCollectedField(memory, "numberOfLives");
    }
    const livesQuestion = /quantas vidas|quantas pessoas|quantidade de pessoas|numero de vidas|beneficiari/.test(normalizeForMatching(memory.lastQuestionAsked ?? ""));
    const answersLivesWithPara = livesQuestion ? trimmed.match(/^para\s*(\d{1,2})$/i) : null;
    if (!memory.numberOfLives && answersLivesWithPara) {
      memory.numberOfLives = { value: answersLivesWithPara[1], confidence: 1, sourceMessageId };
      addCollectedField(memory, "numberOfLives");
    }
    for (const pattern of NUMBER_OF_LIVES_PATTERNS) {
      // A number in an age answer is an age, not a quantity.
      if (memory.numberOfLives || listedAges.length) break;
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const num = parseInt(match[1], 10);
        if (num > 0 && num < 100) {
          memory.numberOfLives = { value: String(num), confidence: 1, sourceMessageId };
          addCollectedField(memory, "numberOfLives");
          break;
        }
      }
    }
  }

  // Age extraction. Long answers commonly include several ages (and, for a
  // PME, those ages are the requested average-age signal). Restrict the
  // unrestricted scan to an age question so numbers such as "2 vidas" are
  // never mistaken for ages.
  // Migrate memories created before PME ages were stored as averageAge. This
  // keeps an in-flight conversation from asking the same age question again
  // after a restart or an attachment.
  if (memory.planType?.value === "empresarial" && !memory.averageAge?.value && memory.age?.value) {
    const previousAges = memory.age.value.split(/[,\s]+/).map(Number).filter((age) => age > 0 && age < 150);
    if (previousAges.length > 0) {
      memory.averageAge = {
        value: String(Math.round(previousAges.reduce((sum, age) => sum + age, 0) / previousAges.length)),
        confidence: memory.age.confidence,
        sourceMessageId: memory.age.sourceMessageId,
      };
    }
  }
  if (!memory.age) {
    const previousQuestion = normalizeForMatching(memory.lastQuestionAsked ?? "");
    const asksForAge = previousQuestion.includes("idade") || previousQuestion.includes("quantos anos");
    // A baby's age in days, weeks or months ("bebê de 16 dias") is 0 years.
    const babyAge = /\b\d{1,2}\s*(?:dias?|semanas?|m[eê]s(?:es)?)\b|\brec[eé]m[- ]nascid/i.test(trimmed);
    const ageText = babyAge ? trimmed.replace(/\b\d{1,2}\s*(?:dias?|semanas?|m[eê]s(?:es)?)\b/gi, "0 anos") : trimmed;
    const listedAgeValues = readAgeList(ageText).filter((age) => age > 0 || babyAge);
    const selfOnlyAge = readSelfOnlyAge(ageText);
    const explicitAgeValues = selfOnlyAge !== null
      ? [selfOnlyAge]
      : listedAgeValues.length > 1
      ? listedAgeValues
      : Array.from(ageText.matchAll(/\b(\d{1,3})\s*a?\s*nos?\b/gi))
        .map((match) => Number(match[1]))
        .filter((age) => (age > 0 || babyAge) && age < 150);
    const ageValues = explicitAgeValues.length > 0
      ? explicitAgeValues
      : asksForAge
        ? ageText.match(/\d{1,3}/g)?.map(Number).filter((age) => (age > 0 || babyAge) && age < 150) ?? []
        : [];
    if (ageValues.length > 0) {
      if (memory.planType?.value === "empresarial") {
        const average = Math.round(ageValues.reduce((sum, age) => sum + age, 0) / ageValues.length);
        memory.averageAge = { value: String(average), confidence: 1, sourceMessageId };
      } else if (asksForAge || explicitAgeValues.length > 0) {
        memory.age = { value: ageValues.join(", "), confidence: 1, sourceMessageId };
      }
      addCollectedField(memory, "age");
    }
    for (const pattern of AGE_PATTERNS) {
      if (memory.age || memory.averageAge) break;
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const age = parseInt(match[1], 10);
        if (age > 0 && age < 150) {
          memory.age = { value: String(age), confidence: 1, sourceMessageId };
          addCollectedField(memory, "age");
          break;
        }
      }
    }
  }

  // Email extraction
  if (!memory.email) {
    for (const pattern of EMAIL_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        memory.email = { value: match[1].trim(), confidence: 1, sourceMessageId };
        addCollectedField(memory, "email");
        break;
      }
    }
    // The e-mail is a convenience: "prefiro não informar" ends the question
    // instead of repeating it. The lead's e-mail is only saved when it has "@".
    const asksForEmail = /e-?mail/.test(normalizeForMatching(memory.lastQuestionAsked ?? ""));
    if (!memory.email && asksForEmail && /^(?:(?:eu\s+)?(?:prefiro|quero)\s+nao\s+(?:informar|passar|dizer)|nao\s+(?:tenho|uso|quero\s+(?:informar|passar)|vou\s+(?:informar|passar))(?:\s+e-?mail)?|sem\s+e-?mail|pula|pular|pode\s+pular|depois\s+eu\s+(?:passo|mando))$/.test(normalizeForMatching(trimmed).replace(/[.!]+$/, ""))) {
      memory.email = { value: EMAIL_DECLINED, confidence: 1, sourceMessageId };
      addCollectedField(memory, "email");
    }
  }

  // CNPJ detection
  if (memory.companyHasCnpj?.value !== "true") {
    // Mentioning a company/MEI is not proof that a CNPJ was provided. Only
    // advance this field when the message explicitly contains the CNPJ term.
    if (hasCnpjEvidence && CNPJ_PATTERNS.some((p) => p.test(trimmed))) {
      memory.companyHasCnpj = { value: "true", confidence: 1, sourceMessageId };
      addCollectedField(memory, "companyHasCnpj");
    }
  }

  // Intent extraction
  if (!memory.intent) {
    for (const pattern of INTENT_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const intent = match[1]
          .split(/\b(?:pois|porque|já que|ja que|moro|moramos|resido|residimos)\b/i)[0]
          .trim()
          .replace(/[,:;]+$/, "")
          .trim()
          .slice(0, 120);
        if (!intent) continue;
        memory.intent = { value: intent, confidence: 1, sourceMessageId };
        addCollectedField(memory, "intent");
        break;
      }
    }
  }

  memory.updatedAt = new Date().toISOString();
  return memory;
}

function addCollectedField(memory: ConversationMemory, key: string) {
  if (!memory.collectedFields.includes(key)) {
    memory.collectedFields.push(key);
  }
}

const commonWords = new Set([
  "bom", "dia", "tarde", "noite", "sim", "não", "nao", "oi", "ola", "olá",
  "obrigado", "obrigada", "ok", "tudo", "bem", "aqui", "ali", "la", "lá",
]);

/**
 * A bare answer to the city question is intentionally conservative. Long
 * answers can contain a sentence such as "Estou saindo p dar aulas"; treating
 * that sentence as a city makes the engine believe the qualification is
 * complete and can trigger a premature handoff. Explicit location phrases
 * ("moro em ...") are handled above, while this guard is used for short,
 * context-only answers such as "Cabo Frio, RJ".
 */
function isLikelyCityAnswer(value: string): boolean {
  const normalized = normalizeForMatching(value).trim();
  if (!/^[\p{L}][\p{L} .'-]{2,59}$/u.test(value.trim())) return false;
  if (commonWords.has(normalized)) return false;

  const nonCityWords = new Set([
    "aulas", "aqui", "anos", "bem", "busco", "cidade", "cnpj", "com",
    "acima", "aulas", "como", "empresa", "estou", "eu", "familiar", "gostaria", "idade",
    "individual", "leia", "ler", "logo", "mei", "nao", "não", "obgda", "obrigada", "obrigado",
    "pessoas", "pf", "pj", "plano", "por", "porem", "porque", "procuro", "quero", "saindo",
    "sem", "seria", "sim", "tenho", "vidas", "vou", "voltarei",
  ]);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  if (words.some((word) => nonCityWords.has(word))) return false;
  return true;
}

const NON_NAME_PREFIXES = new Set([
  "empresa", "plano", "caso", "nosso", "nossa", "seriam", "tenho",
  "gostaria", "gostariamos", "queremos", "recebemos", "cliente",
]);

// ─── Question similarity detection ───────────────────────────────────────────

const QUESTION_SYNONYMS: Record<string, string[]> = {
  name: [
    "qual é o seu nome", "como você se chama", "como posso te chamar",
    "me diga seu nome", "seu nome", "nome", "com quem eu falo",
    "como você se chama", "qual seu nome",
  ],
  planType: [
    "que tipo de plano", "individual ou empresarial", "pf ou pj",
    "para você ou empresa", "plano individual ou para empresa",
    "busca plano individual", "para pessoa física ou jurídica",
    "para você ou sua empresa",
  ],
  city: [
    "qual sua cidade", "de onde você é", "onde você mora",
    "em qual cidade", "cidade", "qual cidade",
  ],
  age: [
    "qual sua idade", "quantos anos você tem", "sua idade",
    "idade", "anos",
  ],
  numberOfLives: [
    "quantas pessoas", "para quantas pessoas", "número de vidas",
    "quantos beneficiários", "quantos familiares", "só você ou mais pessoas",
  ],
  email: [
    "qual seu email", "seu email", "e-mail", "email para contato",
  ],
};

/**
 * Checks if a question is semantically equivalent to any previously asked question.
 * Returns true if the question should be considered a repeat.
 */
export function isQuestionRepeated(
  question: string,
  memory: ConversationMemory,
): { repeated: boolean; field?: string } {
  const lower = question.toLowerCase().trim();

  // Check each known field against its synonyms
  for (const [field, synonyms] of Object.entries(QUESTION_SYNONYMS)) {
    const fieldKey = field as keyof ConversationMemory;

    // If the field is already collected AND the question matches known patterns for it
    if (memory.collectedFields.includes(field as string)) {
      for (const synonym of synonyms) {
        if (lower.includes(synonym) || synonym.includes(lower)) {
          return { repeated: true, field };
        }
      }
    }
  }

  return { repeated: false };
}

/**
 * Builds a markdown context block describing what the AI already knows about the customer.
 * This is injected into the system prompt before each generation.
 */
export function buildMemoryContext(memory: ConversationMemory): string {
  const parts: string[] = ["DADOS COLETADOS DO CLIENTE:"];

  if (memory.customerName?.value) {
    parts.push(`- Nome: ${memory.customerName.value}`);
  } else if (memory.customerFirstName?.value) {
    parts.push(`- Primeiro nome: ${memory.customerFirstName.value}`);
  }

  if (memory.city?.value) parts.push(`- Cidade: ${memory.city.value}`);
  if (memory.planType?.value) parts.push(`- Tipo de plano: ${memory.planType.value}`);
  if (memory.numberOfLives?.value) parts.push(`- N° de vidas: ${memory.numberOfLives.value}`);
  if (memory.planType?.value === "empresarial" && memory.averageAge?.value) parts.push(`- Média de idade do grupo: ${memory.averageAge.value} anos`);
  else if (memory.age?.value) parts.push(`- Idades: ${memory.age.value}`);
  if (memory.email?.value) parts.push(`- E-mail: ${memory.email.value}`);
  if (memory.intent?.value) parts.push(`- Intenção: ${memory.intent.value}`);

  if (memory.collectedFields.length > 0) {
    const missingFields = COLLECTIBLE_FIELDS.filter(
      (f) => f.key === "age" && memory.planType?.value === "empresarial"
        ? !memory.averageAge?.value
        : !memory.collectedFields.includes(f.key),
    );
    if (missingFields.length > 0) {
      parts.push("");
      parts.push("INFORMAÇÕES AINDA NÃO COLETADAS:");
      missingFields.forEach((f) => parts.push(`- ${f.promptLabel}`));
    }
  }

  parts.push("");
  parts.push("REGRAS:");
  parts.push("- NUNCA pergunte novamente informações que já estão em DADOS COLETADOS.");
  parts.push("- Se uma informação foi fornecida, use-a na resposta. Ex: 'Certo, Carlos...'");
  parts.push("- Faça apenas UMA pergunta por vez, sobre a próxima informação necessária.");
  if (memory.planType?.value === "empresarial") parts.push("- Para PME, pergunte a média aproximada de idade do grupo; não peça idades individuais.");
  parts.push("- Se todos os dados essenciais foram coletados, encerre a coleta.");

  return parts.join("\n");
}

/**
 * Creates a fresh empty memory.
 */
export function createEmptyMemory(): ConversationMemory {
  return {
    collectedFields: [],
    updatedAt: new Date().toISOString(),
  };
}
