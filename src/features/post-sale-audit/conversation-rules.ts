import { z } from "zod";

export const postSaleAnswerSchema = z.object({
  contacted: z.boolean().nullable().optional(),
  speed: z.enum(["fast", "slow", "not_applicable", "unknown"]).optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  sentiment: z.enum(["positive", "neutral", "negative", "unknown"]).optional(),
  receivedQuote: z.boolean().nullable().optional(),
  closed: z.enum(["yes", "no", "deciding", "unknown"]).optional(),
  wantsHelp: z.boolean().nullable().optional(),
  reason: z.string().max(300).nullable().optional(),
  comment: z.string().max(500).nullable().optional(),
  optOut: z.boolean().optional(),
});

export type PostSaleAnswers = z.infer<typeof postSaleAnswerSchema>;

const ACTIVE_SURVEY_STATUSES = new Set(["sent", "answering"]);
const ACTIVE_SURVEY_WINDOW_MS = 5 * 86_400_000;

export function isActivePostSaleSurvey(input: { status: string; sentAt: Date | null; channelType: string | null; channelRef: string | null }, expected: { channelType: string; channelRef: string; now?: Date }) {
  const now = expected.now ?? new Date();
  return ACTIVE_SURVEY_STATUSES.has(input.status)
    && Boolean(input.sentAt && input.sentAt.getTime() >= now.getTime() - ACTIVE_SURVEY_WINDOW_MS)
    && Boolean(input.sentAt && input.sentAt.getTime() <= now.getTime())
    && input.channelType === expected.channelType
    && input.channelRef === expected.channelRef;
}

export function detectPostSaleKeywords(text: string, question = ""): PostSaleAnswers {
  const value = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const focus = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const simpleYes = /^(sim|s|claro|com certeza|isso|exatamente|pode ser)$/.test(value);
  const simpleNo = /^(nao|n|ainda nao|nenhum|nenhuma)$/.test(value);
  const yes = /\b(sim|s|claro|conseguiu|fechei|fechamos|recebi|recebeu|falaram|falou comigo)\b/.test(value);
  const no = /\b(nao|nunca|ainda nao|ninguem|nenhum|nao recebi|nao fechou)\b/.test(value);
  const ratingMatch = value.match(/(?:nota\s*)?\b([1-5])\b/);
  const optOut = /\b(pare|parar|remova|remover|nao quero|nao me chame|cancele)\b/.test(value);
  const permissionQuestion = focus.includes("permissao") || focus.includes("duas perguntas");
  const contactQuestion = !permissionQuestion && (focus.includes("corretor") || focus.includes("falar"));
  const quoteQuestion = focus.includes("cotacao") || focus.includes("proposta");
  const helpQuestion = focus.includes("ajuda");
  const closedQuestion = focus.includes("fechar") || focus.includes("fechou");
  const reasonQuestion = focus.includes("motivo") || focus.includes("pesou") || focus.includes("decisao");
  const explicitContactYes = /\b(falei com|falou comigo|conseguiu falar|entrou em contato|me ligou)\b/.test(value);
  const explicitContactNo = /\b(nao falei com|nao conseguiu falar|ninguem me chamou|nao entrou em contato)\b/.test(value);
  const contacted = permissionQuestion ? null
    : contactQuestion && simpleYes ? true
      : contactQuestion && simpleNo ? false
        : explicitContactYes ? true
          : explicitContactNo ? false
            : !focus ? yes ? true : no ? false : null
              : null;
  return {
    contacted,
    rating: ratingMatch ? Number(ratingMatch[1]) : null,
    receivedQuote: quoteQuestion && simpleYes ? true : quoteQuestion && simpleNo ? false : /\b(cotacao|proposta)\b/.test(value) ? (no ? false : true) : null,
    closed: /\b(fechei|fechamos|contratei|contratamos)\b/.test(value) || (closedQuestion && simpleYes) ? "yes" : /\b(decidindo|pensando|avaliando)\b/.test(value) ? "deciding" : /\b(nao fechei|nao contratei)\b/.test(value) || (closedQuestion && simpleNo) ? "no" : "unknown",
    wantsHelp: /\b(ajuda|quero que ligue|me ligue|preciso falar)\b/.test(value) ? true : helpQuestion && simpleYes ? true : helpQuestion && simpleNo ? false : no ? false : null,
    speed: /\b(rapido|rapida|logo|demorou|demorada|lento|lenta)\b/.test(value) ? (/\b(demorou|demorada|lento|lenta)\b/.test(value) ? "slow" : "fast") : "unknown",
    sentiment: /\b(pessimo|ruim|mal|insatisfeito|insatisfeita)\b/.test(value) ? "negative" : /\b(otimo|otima|excelente|bem|bom|boa)\b/.test(value) ? "positive" : "unknown",
    reason: reasonQuestion ? text.trim().slice(0, 300) || null : null,
    comment: text.trim().slice(0, 500) || null,
    optOut,
  };
}

export function postSaleNextTurn(step: number, previous: PostSaleAnswers, answer: PostSaleAnswers, names: { lead: string; broker: string }) {
  const merged = { ...previous, ...Object.fromEntries(Object.entries(answer).filter(([, value]) => value !== undefined && value !== null && value !== "unknown")) } as PostSaleAnswers;
  const normalizedComment = (answer.comment ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const explicitStop = /\b(pare|parar|remova|remover|nao quero|nao me chame|cancele)\b/.test(normalizedComment);
  const declinesIntroduction = step === 0 && !explicitStop && (answer.contacted === false || /\b(agora nao|nao precisa|prefiro nao|hoje nao)\b/.test(normalizedComment) || /^(nao|agora nao|hoje nao)$/.test(normalizedComment.trim()));
  if (answer.optOut && !declinesIntroduction) return { status: "opted_out" as const, step, text: "Tudo bem. Obrigada por avisar. Não vamos mais enviar mensagens de pesquisa." , answers: merged, outcome: "other" as const };
  if (declinesIntroduction) return { status: "completed" as const, step, text: `Sem problema, ${names.lead}. Obrigada pelo seu tempo. Se precisar, estamos por aqui.`, answers: merged, outcome: "other" as const };
  if (step === 0) return { status: "answering" as const, step: 1, text: `Obrigada, ${names.lead}! Você conseguiu falar com ${names.broker}?`, answers: merged };
  if (step === 1) {
    if (merged.contacted === false) return { status: "answering" as const, step: 3, text: `Poxa, sinto muito. Você ainda quer ajuda com o plano?`, answers: merged };
    if (merged.contacted !== true) return { status: "answering" as const, step, text: `Você conseguiu falar com ${names.broker}?`, answers: merged };
    return { status: "answering" as const, step: 2, text: "Que bom. Como foi o atendimento? Se quiser, pode dar uma nota de 1 a 5.", answers: merged };
  }
  if (step === 2) return { status: "answering" as const, step: 3, text: "Você chegou a receber uma cotação?", answers: merged };
  if (step === 3 && merged.contacted === false) return { status: "completed" as const, step, text: `Obrigada por me contar, ${names.lead}. A equipe poderá retomar seu atendimento.`, answers: merged, outcome: "no_contact" as const };
  if (step === 3) return { status: "answering" as const, step: 4, text: "E você chegou a fechar o plano?", answers: merged };
  if (step === 4 && merged.closed === "no") return { status: "answering" as const, step: 5, text: "Se quiser contar, o que mais pesou na decisão?", answers: merged };
  return { status: "completed" as const, step, text: `Obrigada pelo seu tempo, ${names.lead}! Isso ajuda a gente a cuidar melhor de você.`, answers: merged, outcome: merged.closed === "yes" ? "closed" as const : "ok" as const };
}

export function businessHoursBetween(start: Date, end: Date) {
  if (end <= start) return 0;
  let total = 0;
  const parts = (date: Date) => {
    const values = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (type: string) => values.find((part) => part.type === type)?.value ?? "";
    return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")) };
  };
  let day = parts(start);
  const lastDay = parts(end);
  for (let index = 0; index < 370; index += 1) {
    const businessDay = day.weekday >= 1 && day.weekday <= 5;
    if (businessDay) {
      // São Paulo is UTC-03:00 in 2026. Constructing the business window from
      // the local calendar date keeps this calculation O(days), not O(minutes).
      const opening = Date.UTC(day.year, day.month - 1, day.day, 11);
      const closing = Date.UTC(day.year, day.month - 1, day.day, 21);
      total += Math.max(0, Math.min(end.getTime(), closing) - Math.max(start.getTime(), opening));
    }
    if (day.year === lastDay.year && day.month === lastDay.month && day.day === lastDay.day) break;
    const next = new Date(Date.UTC(day.year, day.month - 1, day.day + 1, 12));
    day = parts(next);
  }
  return total;
}
