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
  if (typeof answers.contacted === "boolean") chips.push(answers.contacted ? { label: "Foi atendido", tone: "good" } : { label: "Não foi atendido", tone: "bad" });
  const rating = input.rating ?? (typeof answers.rating === "number" ? answers.rating : null);
  if (rating !== null) chips.push({ label: `Nota ${rating}/5`, tone: rating <= 2 ? "bad" : rating >= 4 ? "good" : "neutral" });
  if (answers.closed === "yes") chips.push({ label: "Fechou", tone: "good" });
  else if (answers.closed === "no") chips.push({ label: "Não fechou", tone: "neutral" });
  if (answers.wantsHelp === true) chips.push({ label: "Quer ajuda", tone: "bad" });
  if (!chips.length && typeof answers.comment === "string" && /agora n[aã]o/i.test(answers.comment)) chips.push({ label: "Agora não", tone: "neutral" });
  return chips;
}
