/**
 * Guards of the operator answers (2026-10-22, pedido do Vinicios): the imported
 * material is the only source of knowledge about operators. A question about an
 * operator never reaches a free model, and an answer that cites nothing or shows
 * a number that is not in the material is blocked.
 */

/**
 * Operators of the Brazilian market, each with the words that name it without
 * doubt. A name that is also a common word or a person's name ("assim", "leve",
 * "alice") only counts with the rest of the name ("assim saude").
 */
export const MARKET_OPERATORS: ReadonlyArray<{ name: string; says: string[] }> = [
  { name: "Amil", says: ["amil"] },
  { name: "Bradesco Saúde", says: ["bradesco"] },
  { name: "SulAmérica", says: ["sulamerica", "sul america"] },
  { name: "Unimed", says: ["unimed"] },
  { name: "Hapvida", says: ["hapvida"] },
  { name: "NotreDame Intermédica", says: ["notredame", "notre dame", "intermedica", "gndi"] },
  { name: "Porto Seguro Saúde", says: ["porto seguro saude", "porto saude"] },
  { name: "Assim Saúde", says: ["assim saude"] },
  { name: "Golden Cross", says: ["golden cross"] },
  { name: "Prevent Senior", says: ["prevent senior"] },
  { name: "Leve Saúde", says: ["leve saude"] },
  { name: "MedSênior", says: ["medsenior", "med senior"] },
  { name: "Care Plus", says: ["care plus", "careplus"] },
  { name: "Omint", says: ["omint"] },
  { name: "Allianz Saúde", says: ["allianz"] },
  { name: "Klini", says: ["klini"] },
  { name: "Qualicorp", says: ["qualicorp"] },
  { name: "Supermed", says: ["supermed"] },
  { name: "Ameplan", says: ["ameplan"] },
  { name: "Trasmontano", says: ["trasmontano"] },
  { name: "São Cristóvão Saúde", says: ["sao cristovao saude"] },
  { name: "Biovida", says: ["biovida"] },
  { name: "Vitallis", says: ["vitallis"] },
  { name: "Plena Saúde", says: ["plena saude"] },
  { name: "Smile Saúde", says: ["smile saude"] },
  { name: "Itálica Saúde", says: ["italica saude"] },
  { name: "Integral Saúde", says: ["integral saude"] },
  { name: "Nossa Saúde", says: ["nossa saude"] },
  { name: "Alice", says: ["alice saude", "plano alice", "operadora alice"] },
  { name: "Sami", says: ["sami saude", "plano sami", "operadora sami"] },
];

/**
 * Words that only make sense about a plan's content, asked without naming the
 * operator. Common words of a lead conversation (vidas, hospital, apartamento)
 * stay out: they would send a normal question away from its assistant.
 */
const PLAN_CONTENT_TERMS = [
  "carencia", "carencias", "coparticipacao", "rede credenciada", "credenciado", "credenciados", "reajuste", "abrangencia",
  "tabela de preco", "tabela de precos", "mensalidade", "reembolso", "doenca preexistente", "doencas preexistentes", "cpt",
  "cobertura do plano", "rol da ans", "portabilidade de carencia",
];

function fold(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}


/** Market operators named in the question (whole words, accent insensitive: "sul america", "notredame"). */
export function marketOperatorsInQuestion(question: string) {
  const text = ` ${fold(question).replace(/[^a-z0-9]+/g, " ")} `;
  return MARKET_OPERATORS.filter((operator) => operator.says.some((words) => text.includes(` ${words} `))).map((operator) => operator.name);
}

/** True when the question is about an operator or a plan's content: it must go to the material, never to a free model. */
export function isOperatorKnowledgeQuestion(question: string, catalogCarrierNames: string[] = []) {
  if (marketOperatorsInQuestion(question).length) return true;
  // Whole words only: "cpt" inside another word is not the term, "assim que" is not "Assim Saúde".
  const text = ` ${fold(question).replace(/[^a-z0-9]+/g, " ")} `;
  const words = (name: string) => fold(name).replace(/[^a-z0-9]+/g, " ").trim();
  if (catalogCarrierNames.some((name) => words(name).length >= 4 && text.includes(` ${words(name)} `))) return true;
  return PLAN_CONTENT_TERMS.some((term) => text.includes(` ${term} `));
}

/** Numbers in a text in a comparable form ("1.234,56" -> "1234.56", "30%" -> "30"). Dates count as their parts. */
export function numbersIn(text: string) {
  const found = new Set<string>();
  for (const match of text.matchAll(/\d[\d.]*(?:,\d+)?/g)) {
    let raw = match[0].replace(/\.$/, "");
    if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
    for (const part of raw.includes(".") && raw.split(".").length > 2 ? raw.split(".") : [raw]) {
      const number = Number(part);
      if (Number.isFinite(number)) found.add(String(number));
    }
  }
  return found;
}

export type GuardVerdict = { ok: true } | { ok: false; reason: "no_citation" | "unknown_citation" | "number_without_source" | "not_found"; detail?: string };

/**
 * Checks a model answer against what it was given: it must cite at least one
 * of the provided items, cite nothing else, and every number in it (price,
 * days, percent, age) must exist in the material or in the question.
 */
export function validateGroundedAnswer(input: { answer: string; validIds: Set<string>; context: string; question: string }): GuardVerdict {
  const cited = [...input.answer.matchAll(/\[([FT]\d{1,3})\]/g)].map((match) => match[1]!);
  if (!cited.length) return { ok: false, reason: "no_citation" };
  const unknown = cited.find((id) => !input.validIds.has(id));
  if (unknown) return { ok: false, reason: "unknown_citation", detail: unknown };

  const allowed = new Set([...numbersIn(input.context), ...numbersIn(input.question)]);
  const body = input.answer
    .replace(/\[[FT]\d{1,3}\]/g, " ")
    // List markers ("1." or "2)") at the start of a line are not data.
    .replace(/^\s*\d{1,2}[.)]\s/gm, " ");
  const inAnswer = [...numbersIn(body)];
  const sourced = inAnswer.filter((number) => allowed.has(number));
  for (const number of inAnswer) {
    if (allowed.has(number)) continue;
    // A total for several lives: the sum of values from the material shown in the answer.
    if (isSumOfSome(Number(number), sourced.map(Number))) continue;
    return { ok: false, reason: "number_without_source", detail: number };
  }
  return { ok: true };
}

/** True when `target` is the sum of two or more of `values` (to the cent). Small lists only. */
export function isSumOfSome(target: number, values: number[]) {
  const cents = values.slice(0, 20).map((value) => Math.round(value * 100)).filter((value) => value > 0);
  const goal = Math.round(target * 100);
  if (goal <= 0 || cents.length < 2) return false;
  // Subset sums with the count of parts (needs at least two).
  let sums = new Map<number, number>([[0, 0]]);
  for (const value of cents) {
    const next = new Map(sums);
    for (const [sum, parts] of sums) {
      const total = sum + value;
      if (total > goal) continue;
      next.set(total, Math.max(next.get(total) ?? 0, parts + 1));
    }
    sums = next;
  }
  return (sums.get(goal) ?? 0) >= 2;
}

export const NOT_FOUND_MESSAGE = "Não encontrei essa informação no material importado das operadoras. Ela ainda não foi importada ou não está catalogada. Peça para importar o material em Ferramentas › Materiais das operadoras.";

export function operatorNotImportedMessage(names: string[]) {
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
  return `Ainda não há material da ${list} importado no catálogo, então não posso responder sobre ela. Assim que o material for importado em Ferramentas › Materiais das operadoras, a resposta passa a usar esses dados.`;
}

/** Below this cosine distance a chunk means about the same as the question (text-embedding-3-small). */
export const MAX_SEMANTIC_DISTANCE = 0.55;

/**
 * Material excerpts that really answer the question: from the operator asked
 * (tagged with it, or naming it when not catalogued yet) and close enough to
 * the question by words or meaning. Anything else is not shown to the model.
 */
export function relevantChunks<T extends { text: string; keywordHits: number; semanticDistance: number | null; carrierId: string | null }>(
  chunks: T[],
  input: { carrierIds: string[]; carrierNames: string[]; keywordCount: number },
) {
  const names = input.carrierNames.map((name) => fold(name).replace(/[^a-z0-9]+/g, " ").trim()).filter((name) => name.length >= 3);
  return chunks.filter((chunk) => {
    if (input.carrierIds.length) {
      if (chunk.carrierId && !input.carrierIds.includes(chunk.carrierId)) return false;
      if (!chunk.carrierId) {
        const text = ` ${fold(chunk.text).replace(/[^a-z0-9]+/g, " ")} `;
        if (!names.some((name) => text.includes(` ${name} `))) return false;
      }
    }
    const closeInMeaning = chunk.semanticDistance !== null && chunk.semanticDistance <= MAX_SEMANTIC_DISTANCE;
    const enoughWords = chunk.keywordHits >= Math.min(2, Math.max(1, input.keywordCount));
    return closeInMeaning || enoughWords;
  });
}

/**
 * What the model said was missing, only when it reads as a sentence in Portuguese
 * (23/10: a fallback model answered "Precisa the the.", shown as is to the broker).
 */
export function readableMissing(text: string | undefined) {
  // Internal codes ([F], [T3]) mean nothing to the broker.
  const clean = text?.replace(/\s*\[(?:[FT]\d*(?:\s*,\s*)?)+\]/g, "").replace(/\s+/g, " ").trim().slice(0, 400);
  if (!clean) return undefined;
  const words = clean.match(/[a-zà-ú]{3,}/gi) ?? [];
  const english = clean.match(/\b(the|and|of|to|is|not|for|with)\b/gi) ?? [];
  return words.length >= 3 && english.length * 4 < words.length ? clean : undefined;
}
