/**
 * Learning of new attendance situations. Pure, no I/O, safe on the client.
 *
 * Every question asked in the middle of the qualification is recorded (L1).
 * The ones no situation covered are grouped by the AI into suggested
 * situations (L2) that a director approves, edits, merges into an existing
 * situation or dismisses (L3). The broker's answer after a transfer enters as
 * a candidate reply (L4). Automatic activation is optional and off by
 * default (L5).
 */
import { normalizeSituationText } from "@/features/attendance-situations/catalog";
import { textVariables } from "@/features/message-library/catalog";

/** Learning events are deleted after this many days. */
export const LEARNING_RETENTION_DAYS = 90;
/** The director is told about a suggestion once it was asked this many times. */
export const NOTIFY_AT_OCCURRENCES = 3;
/** Automatic activation (when on) needs at least this many repeated questions. */
export const AUTO_ACTIVATE_MIN_OCCURRENCES = 5;
/** AI calls per tenant per day for grouping questions (the job runs every 30 minutes). */
export const DAILY_AI_CALL_LIMIT = 12;
/** Questions sent to the AI in one call. */
export const CLUSTER_BATCH_SIZE = 40;
/** Questions asked in the last days that stayed alone, sent again so a new one can join them. */
export const LONE_QUESTION_WINDOW_DAYS = 14;
/** A broker's message counts as the answer to a question when sent within this window. */
export const BROKER_ANSWER_WINDOW_HOURS = 24;

const MAX_QUESTION_LENGTH = 400;

/**
 * Removes what identifies a person before a question is saved: e-mails,
 * links, phone/CPF/CNPJ/CEP numbers and any run of 6 or more digits. Ages and
 * short numbers ("2 pessoas", "45 anos") stay: they are part of the question.
 */
export function scrubPersonalData(value: string | null | undefined) {
  return (value ?? "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[e-mail]")
    .replace(/\bhttps?:\/\/\S+|\bwww\.\S+/gi, "[link]")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[documento]")
    .replace(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[documento]")
    .replace(/\b\d{5}-\d{3}\b/g, "[cep]")
    .replace(/[+(]*\d(?:[\s().-]*\d){5,}\)?/g, "[número]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUESTION_LENGTH);
}

/** Same meaning key used to count repeated questions. */
export function learningKey(question: string) {
  return normalizeSituationText(question);
}

const PRICE_OR_PROMISE = /R\$|\breais\b|\d+[.,]\d{2}\b|\d+\s*%|\bcar[eê]ncia\b|\bgarant(o|imos|ido)\b|\bgr[aá]tis\b|\bdesconto\b|\bpromo[cç][aã]o\b/i;
const ALLOWED_VARIABLES = new Set(["nome", "resumo"]);

/**
 * A reply the AI (or a broker) proposed is kept only when it is safe to send
 * as a fixed text: no price, percentage, waiting period, discount or promise,
 * only the {{nome}}/{{resumo}} variables, and a sensible length.
 */
export function acceptSuggestedReply(raw: string | null | undefined) {
  const text = (raw ?? "").replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").replace(/^["'“]+|["'”]+$/g, "").replace(/[ \t]+/g, " ").trim();
  if (text.length < 10 || text.length > 600) return null;
  if (PRICE_OR_PROMISE.test(text)) return null;
  if (textVariables(text).some((variable) => !ALLOWED_VARIABLES.has(variable))) return null;
  if (/\{(?!\{)|(?<!\})\}/.test(text.replace(/\{\{\s*[\w.]+\s*\}\}/g, ""))) return null;
  return text;
}

/** Up to 3 distinct safe replies. */
export function acceptSuggestedReplies(replies: readonly unknown[]) {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const reply of replies) {
    const text = acceptSuggestedReply(typeof reply === "string" ? reply : null);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    kept.push(text);
    if (kept.length === 3) break;
  }
  return kept;
}

export type LearningQuestion = { id: string; text: string; brokerAnswer?: string | null };
export type KnownSituation = { key: string; title: string; phrases: string[] };
export type PendingSuggestion = { id: string; title: string; examples: string[] };

export function buildClusteringPrompt(input: { questions: LearningQuestion[]; situations: KnownSituation[]; suggestions: PendingSuggestion[] }) {
  const system = [
    "Você ajuda uma corretora de planos de saúde a organizar as dúvidas que clientes mandam no WhatsApp durante o atendimento.",
    "Receberá: SITUAÇÕES que a corretora já tem, SUGESTÕES já abertas e PERGUNTAS de clientes que nenhuma situação cobriu.",
    "Agrupe as perguntas que pedem a mesma coisa (mesmo assunto, mesmo pedido). Para cada grupo, escolha UM destino:",
    '- "existing": o grupo é a mesma dúvida de uma SITUAÇÃO existente (informe "situationKey").',
    '- "suggestion": o grupo é a mesma dúvida de uma SUGESTÃO aberta (informe "suggestionId").',
    '- "new": é uma dúvida nova. Informe "title" (até 60 caracteres, em forma de pergunta ou tema), "phrases" (3 a 8 frases curtas, como o cliente escreveria, sem dados pessoais), "responses" (3 versões de resposta curta e acolhedora, até 2 frases cada) e "action" ("continue" quando a resposta basta e o atendimento segue; "transfer" quando só um corretor pode responder).',
    "Regras das respostas: português do Brasil, tom de WhatsApp, sem preços, valores, percentuais, carências, descontos, coberturas específicas, prazos ou promessas. Pode usar {{nome}} (primeiro nome do cliente). Se o assunto exigir essas informações, diga que o corretor vai detalhar na cotação e use action \"transfer\" quando o cliente pedir algo que só um corretor resolve.",
    "Quando houver RESPOSTA DO CORRETOR junto da pergunta, use-a como base da primeira versão, respeitando as mesmas regras.",
    "Perguntas que não combinam com nenhuma outra nem com situações/sugestões ficam em um grupo sozinhas com destino \"new\" apenas se forem uma dúvida clara sobre o serviço; senão, deixe-as de fora.",
    'Responda somente com JSON no formato {"groups":[{"questionIds":["..."],"target":"existing|suggestion|new","situationKey":"...","suggestionId":"...","title":"...","phrases":["..."],"responses":["...","...","..."],"action":"continue"}]}.',
  ].join("\n");
  const situations = input.situations.length
    ? input.situations.map((situation) => `- ${situation.key}: ${situation.title}${situation.phrases.length ? ` (ex.: ${situation.phrases.slice(0, 5).join("; ")})` : ""}`).join("\n")
    : "(nenhuma)";
  const suggestions = input.suggestions.length
    ? input.suggestions.map((suggestion) => `- ${suggestion.id}: ${suggestion.title} (ex.: ${suggestion.examples.slice(0, 4).join("; ")})`).join("\n")
    : "(nenhuma)";
  const questions = input.questions
    .map((question) => `- ${question.id}: ${question.text}${question.brokerAnswer ? `\n  RESPOSTA DO CORRETOR: ${question.brokerAnswer}` : ""}`)
    .join("\n");
  const user = `SITUAÇÕES:\n${situations}\n\nSUGESTÕES ABERTAS:\n${suggestions}\n\nPERGUNTAS:\n${questions}`;
  return { system, user };
}

export type ClusterGroup =
  | { target: "existing"; questionIds: string[]; situationKey: string }
  | { target: "suggestion"; questionIds: string[]; suggestionId: string }
  | { target: "new"; questionIds: string[]; title: string; phrases: string[]; responses: string[]; action: "continue" | "transfer" };

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Reads the model's JSON (tolerating a code fence), keeping only valid groups over known ids. */
export function parseClusteringResponse(raw: string | null | undefined, known: { questionIds: readonly string[]; situationKeys: readonly string[]; suggestionIds: readonly string[] }): ClusterGroup[] {
  const text = (raw ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  const groups = (parsed as { groups?: unknown })?.groups;
  if (!Array.isArray(groups)) return [];
  const questionIds = new Set(known.questionIds);
  const situationKeys = new Set(known.situationKeys);
  const suggestionIds = new Set(known.suggestionIds);
  const used = new Set<string>();
  const result: ClusterGroup[] = [];
  for (const group of groups as Array<Record<string, unknown>>) {
    const ids = stringList(group?.questionIds).filter((id) => questionIds.has(id) && !used.has(id));
    if (!ids.length) continue;
    if (group.target === "existing" && typeof group.situationKey === "string" && situationKeys.has(group.situationKey)) {
      result.push({ target: "existing", questionIds: ids, situationKey: group.situationKey });
    } else if (group.target === "suggestion" && typeof group.suggestionId === "string" && suggestionIds.has(group.suggestionId)) {
      result.push({ target: "suggestion", questionIds: ids, suggestionId: group.suggestionId });
    } else if (group.target === "new") {
      const title = typeof group.title === "string" ? group.title.replace(/\s+/g, " ").trim().slice(0, 80) : "";
      const phrases = stringList(group.phrases).map((phrase) => scrubPersonalData(phrase).slice(0, 120)).filter((phrase) => phrase.length >= 2).slice(0, 8);
      const responses = acceptSuggestedReplies(stringList(group.responses));
      if (title.length < 3 || !responses.length) continue;
      result.push({ target: "new", questionIds: ids, title, phrases, responses, action: group.action === "transfer" ? "transfer" : "continue" });
    } else {
      continue;
    }
    ids.forEach((id) => used.add(id));
  }
  return result;
}

/**
 * Automatic activation (L5): only when the tenant turned it on, for a new
 * situation that just answers and continues, asked at least 5 times, with a
 * reply that passed the safety check.
 */
export function canAutoActivate(input: { enabled: boolean; kind: "new" | "merge"; action: "continue" | "transfer"; occurrences: number; responses: readonly string[] }) {
  return input.enabled
    && input.kind === "new"
    && input.action === "continue"
    && input.occurrences >= AUTO_ACTIVATE_MIN_OCCURRENCES
    && Boolean(acceptSuggestedReply(input.responses[0]));
}

/** Share of the questions covered by a situation, in whole percent (null without questions). */
export function coveragePercent(input: { covered: number; total: number }) {
  if (input.total <= 0) return null;
  return Math.round((input.covered / input.total) * 100);
}

/** Phrases for the situation: the model's ones plus real questions, deduplicated. */
export function mergeSuggestionPhrases(existing: readonly string[], additions: readonly string[], limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...existing, ...additions]) {
    const phrase = scrubPersonalData(raw).replace(/[?!.]+$/, "").slice(0, 120);
    const key = normalizeSituationText(phrase);
    if (key.length < 2 || seen.has(key)) continue;
    seen.add(key);
    result.push(phrase);
    if (result.length === limit) break;
  }
  return result;
}
