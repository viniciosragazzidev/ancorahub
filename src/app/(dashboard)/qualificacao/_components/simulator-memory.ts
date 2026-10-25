/** Memória do simulador de qualificação: o que o cliente já informou, lido das mensagens (tela atual e Lite). */

export type SimMemory = {
  nome?: string;
  plano?: string;
  vidas?: string;
  idade?: string;
  cidade?: string;
  email?: string;
};

const GREETING_WORDS = new Set([
  "ola", "olá", "oi", "oie", "opa", "salve", "bom dia", "boa tarde", "boa noite",
  "tudo bem", "tudo bom", "como vai", "hei", "hey", "alo", "alô"
]);

export function isPureGreeting(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/gi, "");

  return GREETING_WORDS.has(normalized) || normalized.split(" ").every((w) => GREETING_WORDS.has(w));
}

export function parseInputForFields(text: string, currentMemory: SimMemory): Partial<SimMemory> {
  const extracted: Partial<SimMemory> = {};
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // 1. Extração de Nome
  if (/(?:meu nome e|meu nome é|me chamo|sou o|sou a|eu sou|me chamo de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i.test(trimmed)) {
    const nameMatch = trimmed.match(/(?:meu nome e|meu nome é|me chamo|sou o|sou a|eu sou|me chamo de)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
    if (nameMatch?.[1]) extracted.nome = nameMatch[1].trim();
  } else if (!currentMemory.nome && !isPureGreeting(trimmed) && !lower.includes("plano") && !lower.includes("quanto") && !lower.includes("hospital") && trimmed.length >= 2 && trimmed.length <= 40 && !/\d/.test(trimmed) && !trimmed.includes("@")) {
    extracted.nome = trimmed;
  }

  // 2. Extração de Email
  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch?.[1]) extracted.email = emailMatch[1].trim();

  // 3. Extração de Tipo de Plano
  if (/\b(individual|pf|para mim|so para mim|só para mim|minha pessoa)\b/i.test(lower)) {
    extracted.plano = "Individual";
    if (!currentMemory.vidas) extracted.vidas = "1 pessoa";
  } else if (/\b(familiar|familia|família|para minha familia|para minha família)\b/i.test(lower)) {
    extracted.plano = "Familiar";
  } else if (/\b(pme|pj|empresarial|empresa|para minha empresa|coletivo|cnpj)\b/i.test(lower)) {
    extracted.plano = "Empresarial (PME)";
  }

  // 4. Extração de Quantidade de Vidas
  const livesMatch = trimmed.match(/(\d+)\s*(?:pessoas|vidas|dependentes|integrantes)?/i);
  if (livesMatch?.[1] && Number(livesMatch[1]) > 0 && Number(livesMatch[1]) < 500 && !extracted.idade) {
    if (lower.includes("pessoa") || lower.includes("vida") || lower.includes("integrante") || !currentMemory.vidas) {
      extracted.vidas = `${livesMatch[1]} ${Number(livesMatch[1]) === 1 ? "pessoa" : "pessoas"}`;
    }
  }

  // 5. Extração de Idade
  const ageMatch = trimmed.match(/(\d+)\s*(?:anos|ano)/i);
  if (ageMatch?.[1]) {
    extracted.idade = `${ageMatch[1]} anos`;
  } else if (!currentMemory.idade && currentMemory.vidas && /^\d{1,2}$/.test(trimmed)) {
    extracted.idade = `${trimmed} anos`;
  }

  // 6. Extração de Cidade
  const cityMatch = trimmed.match(/(?:moro em|sou de|na cidade de|em)\s+([A-ZÀ-Úa-zà-ú\s]+)/i);
  if (cityMatch?.[1]) {
    extracted.cidade = cityMatch[1].trim();
  } else if (!currentMemory.cidade && currentMemory.nome && currentMemory.plano && !extracted.nome && !extracted.plano && !isPureGreeting(trimmed) && trimmed.length >= 3 && trimmed.length <= 40 && !/\d/.test(trimmed)) {
    extracted.cidade = trimmed;
  }

  return extracted;
}
