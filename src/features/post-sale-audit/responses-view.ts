/** Pure helpers for the post-sale screen lists (09/11): pagination, search and answer chips. */

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

/** Short tags for one answer: was attended, rating, closed, wants help, declined, opted out. */
export function answerChips(input: { status: string; outcome: string | null; rating: number | null; answers: Record<string, unknown> }): AnswerChip[] {
  const chips: AnswerChip[] = [];
  const answers = input.answers;
  if (answers.optOut === true || input.status === "opted_out") return [{ label: "Pediu para parar", tone: "neutral" }];
  const r0 = answers.r0 && typeof answers.r0 === "object" && !Array.isArray(answers.r0) ? answers.r0 as Record<string, unknown> : null;
  if (r0) {
    const r0Chips: AnswerChip[] = [{ label: "Voltou a escrever", tone: "neutral" }];
    if (r0.category === "not_attended") r0Chips.push({ label: "Não foi atendido", tone: "bad" });
    else if (r0.category === "wants_more") r0Chips.push({ label: "Quer ajuda", tone: "bad" });
    else if (r0.category === "closed_or_gave_up") r0Chips.push(r0.closedKind === "gave_up" ? { label: "Desistiu", tone: "neutral" } : { label: "Já fechou", tone: "neutral" });
    else if (r0.category === "other_subject") r0Chips.push({ label: "Outro assunto", tone: "neutral" });
    if (typeof r0.escalatedAt === "string") r0Chips.push({ label: "Sem resposta da equipe", tone: "bad" });
    return r0Chips;
  }
  if (typeof answers.contacted === "boolean") chips.push(answers.contacted ? { label: "Foi atendido", tone: "good" } : { label: "Não foi atendido", tone: "bad" });
  const rating = input.rating ?? (typeof answers.rating === "number" ? answers.rating : null);
  if (rating !== null) chips.push({ label: `Nota ${rating}/5`, tone: rating <= 2 ? "bad" : rating >= 4 ? "good" : "neutral" });
  if (answers.closed === "yes") chips.push({ label: "Fechou", tone: "good" });
  else if (answers.closed === "no") chips.push({ label: "Não fechou", tone: "neutral" });
  if (answers.wantsHelp === true) chips.push({ label: "Quer ajuda", tone: "bad" });
  if (answers.recommends === true) chips.push({ label: "Indicaria", tone: "good" });
  else if (answers.recommends === false) chips.push({ label: "Não indicaria", tone: "bad" });
  if (!chips.length && typeof answers.comment === "string" && /agora n[aã]o/i.test(answers.comment)) chips.push({ label: "Agora não", tone: "neutral" });
  return chips;
}

export type ResponseGroup = "all" | "not_attended" | "wants_help" | "low_rating" | "attended" | "declined" | "opted_out";

export const RESPONSE_GROUP_LABELS: Record<ResponseGroup, string> = {
  all: "Todos",
  not_attended: "Não foi atendido",
  wants_help: "Quer ajuda",
  low_rating: "Nota baixa",
  attended: "Foi atendido",
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
  if (labels.has("Agora não")) groups.push("declined");
  if (labels.has("Pediu para parar")) groups.push("opted_out");
  return groups;
}
