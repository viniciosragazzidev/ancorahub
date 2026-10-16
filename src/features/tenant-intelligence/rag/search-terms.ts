/** Words that appear in almost every question and say nothing about which material answers it. */
const STOPWORDS = new Set([
  "que", "qual", "quais", "quando", "como", "onde", "para", "por", "com", "sem", "uma", "uns", "umas", "dos",
  "das", "nos", "nas", "pelo", "pela", "pelos", "pelas", "ele", "ela", "eles", "elas", "isso", "isto", "esse",
  "essa", "esses", "essas", "este", "esta", "estes", "estas", "meu", "minha", "seu", "sua", "tem", "tinha",
  "ser", "foi", "são", "sao", "mais", "menos", "muito", "entre", "sobre", "ate", "até", "pode", "posso",
  "preciso", "quero", "gostaria", "favor", "calcule", "calcular", "me", "diga", "informe",
]);

/** Removes accents, so "cotação" and "cotacao" are the same term. */
export function stripAccents(value: string) {
  return value.normalize("NFD").replace(/\p{M}+/gu, "");
}

/**
 * The terms of a question that are worth searching for: lowercase, without
 * accents, no stopwords, no duplicates, at least 3 characters, at most `max`.
 */
export function extractSearchKeywords(query: string, max = 8): string[] {
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const raw of stripAccents(query.toLowerCase()).split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3 || STOPWORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    terms.push(raw);
    if (terms.length >= max) break;
  }
  return terms;
}

/** A SQL LIKE pattern for a term, with the LIKE wildcards in the term itself escaped. */
export function likePattern(term: string) {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

const ACCENTED_LOWER = "áàâãäéèêëíìîïóòôõöúùûüç";
const PLAIN_LOWER = [...ACCENTED_LOWER].map(stripAccents).join("");

/**
 * Arguments for `translate(text, from, to)` in SQL: maps accented letters (both
 * cases) to plain lowercase letters. Works without the `unaccent` extension.
 */
export const SQL_ACCENT_FROM = ACCENTED_LOWER + ACCENTED_LOWER.toUpperCase();
export const SQL_ACCENT_TO = PLAIN_LOWER + PLAIN_LOWER;
