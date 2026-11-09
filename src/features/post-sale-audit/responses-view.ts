/** Pure helpers for the post-sale screen lists (09/11): pagination, search and answer chips. */

import { COMPLAINT_KIND_LABELS, QUESTION_TOPIC_LABELS, readIntentState, type PostSaleIntentState } from "./intents";
import { readLossReasonCheck } from "./loss-reason-check";

export const POST_SALE_PAGE_SIZE = 10;

export function paginate<T>(items: readonly T[], page: number, size = POST_SALE_PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function matchesSearch(fields: ReadonlyArray<string | null | undefined>, query: string) {
  const term = normalize(query.trim());
  if (!term) return true;
  return fields.some((field) => field && normalize(field).includes(term));
}

export type AnswerChip = { label: string; tone: "good" | "bad" | "neutral" };

/** Chips da conversa inteligente (09/11): o que o cliente pediu ou contou além da pergunta. */
function intentChips(intents: PostSaleIntentState | null): AnswerChip[] {
  if (!intents) return [];
  const chips: AnswerChip[] = [];
  const has = (intent: PostSaleIntentState["list"][number]) => intents.list.includes(intent);
  if (has("health_urgency")) chips.push({ label: "Urgência de saúde", tone: "bad" });
  if (has("wrong_person")) chips.push({ label: "Número errado", tone: "neutral" });
  if (has("price_request")) chips.push({ label: "Pediu valores", tone: "bad" });
  if (has("wants_human")) chips.push({ label: "Quer falar com alguém", tone: "bad" });
  if (has("scheduling")) chips.push({ label: intents.scheduleText ? `Contato: ${intents.scheduleText}` : "Pediu horário", tone: "neutral" });
  if (has("complaint")) chips.push({ label: "Reclamou do atendimento", tone: "bad" });
  if (has("closed_elsewhere")) chips.push({ label: "Fechou por fora", tone: "neutral" });
  if (has("gave_up")) chips.push({ label: "Desistiu", tone: "neutral" });
  if (has("question")) chips.push({ label: intents.questionTopic && intents.questionTopic !== "other" ? `Dúvida: ${QUESTION_TOPIC_LABELS[intents.questionTopic]}` : "Fez uma pergunta", tone: "neutral" });
  if (has("praise")) chips.push({ label: "Elogiou", tone: "good" });
  return chips;
}

/** Linhas de detalhe da resposta aberta: horário pedido, fala da reclamação, dúvida, com quem fechou. */
export function intentDetails(answers: Record<string, unknown>): string[] {
  const intents = readIntentState(answers);
  if (!intents) return [];
  return [
    intents.scheduleText ? `Pediu contato: ${intents.scheduleText}.` : null,
    intents.list.includes("complaint") && intents.complaintQuote ? `Reclamação${intents.complaintKind && intents.complaintKind !== "other" ? ` (${COMPLAINT_KIND_LABELS[intents.complaintKind]})` : ""}: “${intents.complaintQuote}”` : null,
    intents.list.includes("question") && intents.questionText ? `Dúvida: “${intents.questionText}”` : null,
    intents.closedWith ? `Fechou com: ${intents.closedWith}.` : null,
    intents.gaveUpReason && intents.list.includes("gave_up") ? `Desistência: “${intents.gaveUpReason}”` : null,
  ].filter((line): line is string => Boolean(line));
}

/** Short tags for one answer: was attended, rating, closed, wants help, declined, opted out. */
export function answerChips(input: { status: string; outcome: string | null; rating: number | null; answers: Record<string, unknown> }): AnswerChip[] {
  const chips: AnswerChip[] = [];
  const answers = input.answers;
  if (answers.optOut === true || input.status === "opted_out") return [{ label: "Pediu para parar", tone: "neutral" }];
  const intents = readIntentState(answers);
  const extra = intentChips(intents).filter((chip) => !(chip.label === "Desistiu" && answers.r0));
  const r0 = answers.r0 && typeof answers.r0 === "object" && !Array.isArray(answers.r0) ? answers.r0 as Record<string, unknown> : null;
  if (r0) {
    const r0Chips: AnswerChip[] = [{ label: "Voltou a escrever", tone: "neutral" }];
    if (r0.category === "not_attended") r0Chips.push({ label: "Não foi atendido", tone: "bad" });
    else if (r0.category === "wants_more") r0Chips.push({ label: "Quer ajuda", tone: "bad" });
    else if (r0.category === "closed_or_gave_up") r0Chips.push(r0.closedKind === "gave_up" ? { label: "Desistiu", tone: "neutral" } : { label: "Já fechou", tone: "neutral" });
    else if (r0.category === "other_subject") r0Chips.push({ label: "Outro assunto", tone: "neutral" });
    if (typeof r0.escalatedAt === "string") r0Chips.push({ label: "Sem resposta da equipe", tone: "bad" });
    return dedupe([...r0Chips, ...extra]);
  }
  if (typeof answers.contacted === "boolean") chips.push(answers.contacted ? { label: "Foi atendido", tone: "good" } : { label: "Não foi atendido", tone: "bad" });
  const rating = input.rating ?? (typeof answers.rating === "number" ? answers.rating : null);
  if (rating !== null) chips.push({ label: `Nota ${rating}/5`, tone: rating <= 2 ? "bad" : rating >= 4 ? "good" : "neutral" });
  if (answers.closed === "yes") chips.push({ label: "Fechou", tone: "good" });
  else if (answers.closed === "no") chips.push({ label: "Não fechou", tone: "neutral" });
  if (answers.wantsHelp === true) chips.push({ label: "Quer ajuda", tone: "bad" });
  if (readLossReasonCheck(answers)?.divergent) chips.push({ label: "Motivo diferente", tone: "bad" });
  if (answers.recommends === true) chips.push({ label: "Indicaria", tone: "good" });
  else if (answers.recommends === false) chips.push({ label: "Não indicaria", tone: "bad" });
  chips.push(...extra.filter((chip) => !(chip.label === "Desistiu" && answers.closed === "no" && chips.some((item) => item.label === "Não fechou"))));
  if (!chips.length && typeof answers.comment === "string" && /agora n[aã]o/i.test(answers.comment)) chips.push({ label: "Agora não", tone: "neutral" });
  return dedupe(chips);
}

function dedupe(chips: AnswerChip[]) {
  const seen = new Set<string>();
  return chips.filter((chip) => !seen.has(chip.label) && Boolean(seen.add(chip.label)));
}

export type ResponseGroup = "all" | "not_attended" | "wants_help" | "wants_resume" | "complaint" | "low_rating" | "attended" | "closed_elsewhere" | "gave_up" | "question" | "wrong_number" | "urgency" | "declined" | "opted_out";

export const RESPONSE_GROUP_LABELS: Record<ResponseGroup, string> = {
  all: "Todos",
  not_attended: "Não foi atendido",
  wants_help: "Quer ajuda",
  wants_resume: "Quer retomar",
  complaint: "Reclamação",
  low_rating: "Nota baixa",
  attended: "Foi atendido",
  closed_elsewhere: "Fechou por fora",
  gave_up: "Desistiu",
  question: "Dúvida",
  wrong_number: "Número errado",
  urgency: "Urgência de saúde",
  declined: "Agora não",
  opted_out: "Pediu para parar",
};

/** The groups an answer belongs to (one answer can be in several, e.g. not attended and wants help). */
export function responseGroups(input: { status: string; outcome: string | null; rating: number | null; answers: Record<string, unknown> }): ResponseGroup[] {
  const labels = new Set(answerChips(input).map((chip) => chip.label));
  const rating = input.rating ?? (typeof input.answers.rating === "number" ? input.answers.rating : null);
  const groups: ResponseGroup[] = [];
  if (labels.has("Não foi atendido")) groups.push("not_attended");
  if (labels.has("Quer ajuda")) groups.push("wants_help");
  if (rating !== null && rating <= 2) groups.push("low_rating");
  if (labels.has("Foi atendido")) groups.push("attended");
  const intents = readIntentState(input.answers);
  if (intents?.list.some((intent) => intent === "price_request" || intent === "wants_human" || intent === "scheduling")) groups.push("wants_resume");
  if (labels.has("Reclamou do atendimento")) groups.push("complaint");
  if (labels.has("Fechou por fora") || input.outcome === "r0_closed_elsewhere") groups.push("closed_elsewhere");
  if (labels.has("Desistiu") || input.outcome === "r0_gave_up") groups.push("gave_up");
  if (intents?.list.includes("question")) groups.push("question");
  if (labels.has("Número errado")) groups.push("wrong_number");
  if (labels.has("Urgência de saúde")) groups.push("urgency");
  if (labels.has("Agora não")) groups.push("declined");
  if (labels.has("Pediu para parar")) groups.push("opted_out");
  return groups;
}
