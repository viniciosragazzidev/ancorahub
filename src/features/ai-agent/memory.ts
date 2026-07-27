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
  /(?:moro em|sou de|de|na cidade de|em)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
  /cidade\s*(?:é|:)?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i,
];

const PLAN_TYPE_PATTERNS = [
  /\b(?:individual|PF|para mim|sou eu|só para mim)\b/i,
  /\b(?:familiar|para família|para minha família)\b/i,
  /\b(?:empresarial|PME|PJ|para empresa|para minha empresa|coletivo)\b/i,
];

const NUMBER_OF_LIVES_PATTERNS = [
  /(\d+)\s*(?:pessoas|vidas|familiares|dependentes|pessoal|integrantes)/i,
  /(?:somos|sou|minha família tem)\s*(\d+)/i,
  /para\s*(\d+)\s*(?:pessoas|vidas)/i,
];

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
  /(?:quero|gostaria|preciso de|estou atrás de|busco|procuro)\s+(?:um|uma|de|contratar|saber)\s+([^,.!?]+)/i,
  /(?:cotação|preço|valor|quanto custa|orçamento)/i,
];

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

  // Name extraction
  if (!memory.customerName) {
    for (const pattern of NAME_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const name = match[1].trim();
        if (name.length >= 5 && name.includes(" ")) {
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
    const isJustName = /^[A-ZÀ-Ú][a-zà-ú]+$/.test(trimmed) && trimmed.length >= 2;
    if (isJustName) {
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
        if (city.length >= 3 && !commonWords.has(city.toLowerCase())) {
          memory.city = { value: city, confidence: 1, sourceMessageId };
          addCollectedField(memory, "city");
          break;
        }
      }
    }
  }

  // Plan type extraction
  if (!memory.planType) {
    for (const pattern of PLAN_TYPE_PATTERNS) {
      if (pattern.test(trimmed)) {
        const value =
          /individual|PF|para mim|sou eu|só para mim/i.test(trimmed)
            ? "individual"
            : /familiar|para família|para minha família/i.test(trimmed)
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
    for (const pattern of NUMBER_OF_LIVES_PATTERNS) {
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

  // Age extraction
  if (!memory.age) {
    for (const pattern of AGE_PATTERNS) {
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
    if (CNPJ_PATTERNS.some((p) => p.test(trimmed))) {
      memory.companyHasCnpj = { value: "true", confidence: 1, sourceMessageId };
      addCollectedField(memory, "companyHasCnpj");
    }
  }

  // Intent extraction
  if (!memory.intent) {
    for (const pattern of INTENT_PATTERNS) {
      const match = trimmed.match(pattern);
      if (match?.[1]) {
        const intent = match[1].trim().slice(0, 60);
        memory.intent = { value: intent, confidence: 0, sourceMessageId };
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
  if (memory.age?.value) parts.push(`- Idade: ${memory.age.value}`);
  if (memory.email?.value) parts.push(`- E-mail: ${memory.email.value}`);
  if (memory.intent?.value) parts.push(`- Intenção: ${memory.intent.value}`);

  if (memory.collectedFields.length > 0) {
    const missingFields = COLLECTIBLE_FIELDS.filter(
      (f) => !memory.collectedFields.includes(f.key),
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
