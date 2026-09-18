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
  /** Ordered list of field keys that have been collected */
  collectedFields: string[];
  /** The last question the AI asked, verbatim */
  lastQuestionAsked?: string;
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

const NUMBER_OF_LIVES_PATTERNS = [
  /(\d+)\s*(?:pessoas?|vidas?|familiares?|dependentes?|pessoal|integrantes?)/i,
  /(?:somos|sou|minha família tem|seria para|apenas|para)\s*(\d+)/i,
  /para\s*(\d+)\s*(?:pessoas?|vidas?)/i,
];

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

    const asksForCity = normalizeForMatching(memory.lastQuestionAsked ?? "").includes("cidade");
    // A city answer may include a neighbourhood/region after a comma
    // ("Rio de Janeiro, centro"). Keep the city segment only.
    const bareCity = trimmed.split(",")[0]?.trim() ?? "";
    if (!memory.city && asksForCity && isLikelyCityAnswer(bareCity)) {
      memory.city = { value: bareCity, confidence: 1, sourceMessageId };
      addCollectedField(memory, "city");
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

    for (const pattern of NUMBER_OF_LIVES_PATTERNS) {
      if (memory.numberOfLives) break;
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
    const explicitAgeValues = Array.from(trimmed.matchAll(/\b([1-9]\d?|1[0-4]\d)\s*a?\s*nos?\b/gi))
      .map((match) => Number(match[1]))
      .filter((age) => age > 0 && age < 150);
    const ageValues = explicitAgeValues.length > 0
      ? explicitAgeValues
      : asksForAge
        ? trimmed.match(/\d{1,3}/g)?.map(Number).filter((age) => age > 0 && age < 150) ?? []
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
  }

  // CNPJ detection
  if (!memory.companyHasCnpj) {
    // Mentioning a company/MEI is not proof that a CNPJ was provided. Only
    // advance this field when the message explicitly contains the CNPJ term.
    if (/\bcnpj\b/i.test(trimmed) && CNPJ_PATTERNS.some((p) => p.test(trimmed))) {
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
