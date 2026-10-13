import type { QualificationFieldKey } from "@/features/qualification-engine/reply-composer";

/**
 * The qualification flow the director edits in Atendimento > Fluxo: which
 * questions the AI asks, in which order, and with which words. Pure rules,
 * shared by the page, the action and the tests.
 */

export const QUALIFICATION_FIELDS: ReadonlyArray<{
  key: QualificationFieldKey;
  label: string;
  /** What the built-in wording asks today (shown as the placeholder). */
  defaultText: string;
  /** Words the answer reader needs in the question to understand a short reply ("3", "Niterói"). */
  keywords: RegExp;
  keywordHint: string;
}> = [
  { key: "customerName", label: "Nome", defaultText: "Qual é o seu nome completo?", keywords: /\bnome\b|como voce se chama/, keywordHint: "a palavra \"nome\"" },
  { key: "planType", label: "Tipo de plano", defaultText: "Você busca um plano só para você, para a família ou para uma empresa (CNPJ)?", keywords: /plano|individual|famili|empresa|cnpj/, keywordHint: "\"plano\" ou as opções (individual, família, empresa)" },
  { key: "numberOfLives", label: "Quantidade de vidas", defaultText: "Quantas pessoas vão entrar no plano?", keywords: /quantas vidas|quantas pessoas|quantidade de pessoas|numero de vidas|beneficiari/, keywordHint: "\"quantas pessoas\" ou \"quantas vidas\"" },
  { key: "age", label: "Idade", defaultText: "Quais as idades das pessoas que vão entrar no plano?", keywords: /idade|quantos anos/, keywordHint: "\"idade\" ou \"quantos anos\"" },
  { key: "city", label: "Cidade", defaultText: "Em qual cidade você vai usar o plano?", keywords: /cidade/, keywordHint: "a palavra \"cidade\"" },
  { key: "email", label: "E-mail", defaultText: "Qual o seu melhor e-mail para eu enviar a cotação?", keywords: /e-?mail/, keywordHint: "\"e-mail\"" },
];

export const DEFAULT_QUALIFICATION_ORDER: QualificationFieldKey[] = QUALIFICATION_FIELDS.map((field) => field.key);

const fieldByKey = new Map(QUALIFICATION_FIELDS.map((field) => [field.key, field]));

export function isQualificationFieldKey(value: unknown): value is QualificationFieldKey {
  return typeof value === "string" && fieldByKey.has(value as QualificationFieldKey);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Null when the text can be used; otherwise what is missing, in plain words. */
export function questionTextProblem(key: QualificationFieldKey, text: string): string | null {
  const field = fieldByKey.get(key);
  if (!field) return "Pergunta desconhecida.";
  const trimmed = text.trim();
  if (trimmed.length < 5 || trimmed.length > 300) return `${field.label}: o texto precisa ter entre 5 e 300 caracteres.`;
  if (!field.keywords.test(normalize(trimmed))) return `${field.label}: inclua ${field.keywordHint}, para a IA entender respostas curtas.`;
  return null;
}

/**
 * The questions the director turned on, in the order chosen; a key repeated or
 * unknown is dropped. At least one question must stay on.
 */
export function cleanQualificationOrder(order: readonly unknown[]): QualificationFieldKey[] {
  const seen = new Set<QualificationFieldKey>();
  for (const key of order) if (isQualificationFieldKey(key)) seen.add(key);
  return [...seen];
}

/**
 * The settings form only knows which questions are on: keep the order the
 * director chose for those already on and add the new ones at the end.
 */
export function keepChosenOrder(previous: unknown, selected: readonly string[]): QualificationFieldKey[] {
  const chosen = new Set(cleanQualificationOrder(selected));
  const before = Array.isArray(previous) ? cleanQualificationOrder(previous).filter((key) => chosen.has(key)) : [];
  return [...before, ...[...chosen].filter((key) => !before.includes(key))];
}

/** The saved texts, only for known questions and non-empty. */
export function readQuestionTexts(value: unknown): Partial<Record<QualificationFieldKey, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const texts: Partial<Record<QualificationFieldKey, string>> = {};
  for (const [key, text] of Object.entries(value as Record<string, unknown>)) {
    if (isQualificationFieldKey(key) && typeof text === "string" && text.trim()) texts[key] = text.trim();
  }
  return texts;
}
