/**
 * Visão do pós-venda (24/11): todas as contas da tela Equipe › Pós-venda saem de uma lista de pesquisas do
 * período (uma linha por lead e régua). Funções puras, sem banco: números gerais, funil, por regra, por dia,
 * por corretor, situação de cada pesquisa, filtros e exportação. A tela filtra no navegador sem voltar ao servidor.
 */

import { matchesPostSaleRuleFilter, postSaleRuleLabel, saoPauloDateKey, type PostSaleRuleFilter } from "./auto-rules";
import { answerChips, matchesSearch, responseGroups, type ResponseGroup } from "./responses-view";

export type PostSaleSurveyRow = {
  id: string;
  leadId: string;
  leadName: string;
  brokerId: string | null;
  brokerName: string | null;
  campaignId: string;
  campaignName: string;
  /** null = campanha manual; "R0" = cliente voltou a escrever; R1 a R5 = régua. */
  ruleKey: string | null;
  status: string;
  outcome: string | null;
  rating: number | null;
  answers: Record<string, unknown>;
  skipReason: string | null;
  createdAt: string;
  sentAt: string | null;
  /** Entrega e leitura do WhatsApp (outbox da abertura). */
  deliveredAt: string | null;
  readAt: string | null;
  lastReplyAt: string | null;
  completedAt: string | null;
  alertOpen: boolean;
};

export type PostSaleStage = "queued" | "failed" | "skipped" | "waiting" | "no_reply" | "in_progress" | "completed" | "opted_out";

export const POST_SALE_STAGE_LABELS: Record<PostSaleStage, string> = {
  queued: "Na fila",
  failed: "Falhou",
  skipped: "Não saiu",
  waiting: "Aguardando resposta",
  no_reply: "Sem resposta",
  in_progress: "Em andamento",
  completed: "Concluída",
  opted_out: "Pediu para parar",
};

/** Tom do selo: só status, sempre com texto junto. */
export const POST_SALE_STAGE_TONES: Record<PostSaleStage, "success" | "warning" | "danger" | undefined> = {
  queued: undefined,
  failed: "danger",
  skipped: "warning",
  waiting: undefined,
  no_reply: undefined,
  in_progress: undefined,
  completed: "success",
  opted_out: undefined,
};

export const POST_SALE_STAGE_ORDER: PostSaleStage[] = ["in_progress", "completed", "waiting", "no_reply", "opted_out", "queued", "failed", "skipped"];

/** Situação de uma pesquisa, em uma palavra. */
export function postSaleStage(row: Pick<PostSaleSurveyRow, "status" | "sentAt" | "lastReplyAt">): PostSaleStage {
  if (row.status === "opted_out") return "opted_out";
  if (row.status === "completed") return "completed";
  if (row.status === "failed") return "failed";
  if (row.status === "skipped") return "skipped";
  if (row.status === "answering" || (row.lastReplyAt && row.status === "sent")) return "in_progress";
  if (row.status === "no_reply") return row.lastReplyAt ? "in_progress" : "no_reply";
  if (row.status === "queued" || !row.sentAt) return "queued";
  return "waiting";
}

const wasSent = (row: PostSaleSurveyRow) => Boolean(row.sentAt);
const responded = (row: PostSaleSurveyRow) => Boolean(row.lastReplyAt);
const delivered = (row: PostSaleSurveyRow) => wasSent(row) && Boolean(row.deliveredAt || row.readAt || row.lastReplyAt);
const read = (row: PostSaleSurveyRow) => wasSent(row) && Boolean(row.readAt || row.lastReplyAt);

function validRating(row: PostSaleSurveyRow) {
  const value = row.rating ?? (typeof row.answers.rating === "number" ? row.answers.rating : null);
  return typeof value === "number" && value >= 1 && value <= 5 ? value : null;
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : null;
}

function average(values: number[]) {
  return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
}

export type PostSaleOverviewSummary = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  responded: number;
  inProgress: number;
  completed: number;
  noReply: number;
  optedOut: number;
  failed: number;
  queued: number;
  averageRating: number | null;
  ratingCount: number;
  openAlerts: number;
  responseRate: number | null;
};

export function summarizePostSaleSurveys(rows: readonly PostSaleSurveyRow[]): PostSaleOverviewSummary {
  const summary: PostSaleOverviewSummary = { total: rows.length, sent: 0, delivered: 0, read: 0, responded: 0, inProgress: 0, completed: 0, noReply: 0, optedOut: 0, failed: 0, queued: 0, averageRating: null, ratingCount: 0, openAlerts: 0, responseRate: null };
  const ratings: number[] = [];
  for (const row of rows) {
    const stage = postSaleStage(row);
    if (wasSent(row)) summary.sent += 1;
    if (delivered(row)) summary.delivered += 1;
    if (read(row)) summary.read += 1;
    if (responded(row)) summary.responded += 1;
    if (stage === "in_progress") summary.inProgress += 1;
    if (stage === "completed") summary.completed += 1;
    if (stage === "waiting" || stage === "no_reply") summary.noReply += 1;
    if (stage === "opted_out") summary.optedOut += 1;
    if (stage === "failed" || stage === "skipped") summary.failed += 1;
    if (stage === "queued") summary.queued += 1;
    if (row.alertOpen) summary.openAlerts += 1;
    const rating = validRating(row);
    if (rating !== null) ratings.push(rating);
  }
  summary.averageRating = average(ratings);
  summary.ratingCount = ratings.length;
  summary.responseRate = percent(summary.responded, summary.sent);
  return summary;
}

export type FunnelStep = { id: "sent" | "delivered" | "read" | "responded" | "completed"; label: string; value: number; percent: number | null };

/** Do envio até a conclusão; cada passo em % das enviadas. */
export function postSaleFunnel(summary: PostSaleOverviewSummary): FunnelStep[] {
  const steps: Array<Omit<FunnelStep, "percent">> = [
    { id: "sent", label: "Enviadas", value: summary.sent },
    { id: "delivered", label: "Entregues", value: summary.delivered },
    { id: "read", label: "Lidas", value: summary.read },
    { id: "responded", label: "Responderam", value: summary.responded },
    { id: "completed", label: "Concluíram", value: summary.completed },
  ];
  return steps.map((step) => ({ ...step, percent: percent(step.value, summary.sent) }));
}

export const POST_SALE_RULE_ORDER = ["R0", "R1", "R2", "R3", "R4", "R5", "manual"] as const;
export type PostSaleRuleBucket = (typeof POST_SALE_RULE_ORDER)[number];

export function ruleBucket(ruleKey: string | null): PostSaleRuleBucket {
  return ruleKey && (POST_SALE_RULE_ORDER as readonly string[]).includes(ruleKey) ? ruleKey as PostSaleRuleBucket : "manual";
}

export type RuleBreakdown = { key: PostSaleRuleBucket; label: string; total: number; sent: number; responded: number; failed: number; responseRate: number | null };

/** Uma linha por origem com movimento no período, na ordem R0, R1..R5, Manual. */
export function postSaleByRule(rows: readonly PostSaleSurveyRow[]): RuleBreakdown[] {
  const map = new Map<PostSaleRuleBucket, RuleBreakdown>();
  for (const row of rows) {
    const key = ruleBucket(row.ruleKey);
    const item = map.get(key) ?? { key, label: postSaleRuleLabel(key === "manual" ? null : key), total: 0, sent: 0, responded: 0, failed: 0, responseRate: null };
    item.total += 1;
    if (wasSent(row)) item.sent += 1;
    if (responded(row)) item.responded += 1;
    const stage = postSaleStage(row);
    if (stage === "failed" || stage === "skipped") item.failed += 1;
    map.set(key, item);
  }
  return POST_SALE_RULE_ORDER.flatMap((key) => {
    const item = map.get(key);
    return item ? [{ ...item, responseRate: percent(item.responded, item.sent) }] : [];
  });
}

export type DayBreakdown = { day: string; sent: number; responded: number };

/** Enviadas e respondidas por dia de envio (São Paulo), com os dias vazios do período preenchidos com zero. */
export function postSaleByDay(rows: readonly PostSaleSurveyRow[], periodDays: number, now = new Date()): DayBreakdown[] {
  const days: DayBreakdown[] = [];
  for (let offset = periodDays - 1; offset >= 0; offset -= 1) {
    days.push({ day: saoPauloDateKey(new Date(now.getTime() - offset * 86_400_000)), sent: 0, responded: 0 });
  }
  const index = new Map(days.map((item, position) => [item.day, position]));
  for (const row of rows) {
    if (!row.sentAt) continue;
    const position = index.get(saoPauloDateKey(new Date(row.sentAt)));
    if (position === undefined) continue;
    days[position]!.sent += 1;
    if (responded(row)) days[position]!.responded += 1;
  }
  return days;
}

export type BrokerBreakdown = {
  brokerId: string;
  brokerName: string;
  leads: number;
  sent: number;
  responded: number;
  responseRate: number | null;
  averageRating: number | null;
  /** "Falou com o cliente?": respostas sim e total de respostas a essa pergunta. */
  contactedYes: number;
  contactedAnswered: number;
  contactedPercent: number | null;
  noContact: number;
  openAlerts: number;
  failed: number;
};

export function postSaleByBroker(rows: readonly PostSaleSurveyRow[]): BrokerBreakdown[] {
  const map = new Map<string, BrokerBreakdown & { leadIds: Set<string>; ratings: number[] }>();
  for (const row of rows) {
    const brokerId = row.brokerId ?? "sem-corretor";
    const item = map.get(brokerId) ?? { brokerId, brokerName: row.brokerName ?? "Sem corretor", leads: 0, sent: 0, responded: 0, responseRate: null, averageRating: null, contactedYes: 0, contactedAnswered: 0, contactedPercent: null, noContact: 0, openAlerts: 0, failed: 0, leadIds: new Set<string>(), ratings: [] };
    item.leadIds.add(row.leadId);
    if (wasSent(row)) item.sent += 1;
    if (responded(row)) item.responded += 1;
    if (row.answers.contacted === true || row.answers.contacted === false) {
      item.contactedAnswered += 1;
      if (row.answers.contacted) item.contactedYes += 1;
    }
    if (row.answers.contacted === false || row.outcome === "no_contact" || row.outcome === "r0_not_attended") item.noContact += 1;
    if (row.alertOpen) item.openAlerts += 1;
    const stage = postSaleStage(row);
    if (stage === "failed" || stage === "skipped") item.failed += 1;
    const rating = validRating(row);
    if (rating !== null) item.ratings.push(rating);
    map.set(brokerId, item);
  }
  return [...map.values()].map(({ leadIds, ratings, ...item }) => ({
    ...item,
    leads: leadIds.size,
    responseRate: percent(item.responded, item.sent),
    averageRating: average(ratings),
    contactedPercent: percent(item.contactedYes, item.contactedAnswered),
  })).sort((a, b) => b.openAlerts - a.openAlerts || b.sent - a.sent || a.brokerName.localeCompare(b.brokerName, "pt-BR"));
}

export type PostSaleListFilters = {
  rule: PostSaleRuleFilter;
  stage: PostSaleStage | "all" | "responded";
  brokerId: string;
  /** Dia de envio (aaaa-mm-dd), escolhido na coluna do gráfico. */
  day: string;
  group: ResponseGroup;
  query: string;
};

export const EMPTY_POST_SALE_FILTERS: PostSaleListFilters = { rule: "all", stage: "all", brokerId: "", day: "", group: "all", query: "" };

export function filterPostSaleSurveys(rows: readonly PostSaleSurveyRow[], filters: PostSaleListFilters) {
  return rows.filter((row) => {
    if (!matchesPostSaleRuleFilter(row.ruleKey, filters.rule)) return false;
    if (filters.brokerId && (row.brokerId ?? "sem-corretor") !== filters.brokerId) return false;
    if (filters.stage === "responded" ? !responded(row) : filters.stage !== "all" && postSaleStage(row) !== filters.stage) return false;
    if (filters.day && (!row.sentAt || saoPauloDateKey(new Date(row.sentAt)) !== filters.day)) return false;
    if (filters.group !== "all" && !responseGroups(row).includes(filters.group)) return false;
    return matchesSearch([row.leadName, row.brokerName, typeof row.answers.comment === "string" ? row.answers.comment : null], filters.query);
  });
}

/** Mais recente primeiro: resposta, envio ou criação. */
export function sortPostSaleSurveys(rows: readonly PostSaleSurveyRow[]) {
  const at = (row: PostSaleSurveyRow) => new Date(row.lastReplyAt ?? row.sentAt ?? row.createdAt).getTime();
  return [...rows].sort((a, b) => at(b) - at(a));
}

function contactedLabel(answers: Record<string, unknown>) {
  if (answers.contacted === true) return "Sim";
  if (answers.contacted === false) return "Não";
  return "";
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

const csvDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "";

/** CSV com ponto e vírgula (abre direto no Excel em pt-BR). */
export function postSaleSurveysCsv(rows: readonly PostSaleSurveyRow[]) {
  const header = ["Lead", "Corretor", "Origem", "Situação", "Enviada em", "Respondeu em", "Nota", "Falou com o cliente", "Resumo", "Comentário"];
  const lines = rows.map((row) => [
    row.leadName,
    row.brokerName ?? "Sem corretor",
    postSaleRuleLabel(row.ruleKey),
    POST_SALE_STAGE_LABELS[postSaleStage(row)],
    csvDate(row.sentAt),
    csvDate(row.lastReplyAt),
    validRating(row),
    contactedLabel(row.answers),
    answerChips(row).map((chip) => chip.label).join(", "),
    typeof row.answers.comment === "string" ? row.answers.comment : "",
  ].map(csvCell).join(";"));
  return [header.join(";"), ...lines].join("\r\n");
}
