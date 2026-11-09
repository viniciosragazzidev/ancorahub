import { isPostSaleAlertOpen } from "./alert-rules";
import { matchesPostSaleRuleFilter, type PostSaleRuleFilter } from "./auto-rules";

export type PostSaleReportBroker = { id: string; name: string };

export type PostSaleReportSurvey = {
  brokerId: string | null;
  sentAt: Date | string | null;
  lastReplyAt: Date | string | null;
  outcome: string | null;
  rating: number | null;
  answers: unknown;
  alertsHandledAt: Date | string | null;
  /** "R0" = cliente que voltou a escrever; fica fora das métricas da pesquisa e conta à parte. */
  ruleKey?: string | null;
};

export type PostSaleBrokerReportRow = {
  brokerId: string;
  brokerName: string;
  sent: number;
  responded: number;
  attendancePercent: number | null;
  attendanceAnswered: number;
  attended: number;
  averageRating: number | null;
  /** Notas válidas (1 a 5) e a soma delas: a nota média geral pondera por isso. */
  ratingCount: number;
  ratingTotal: number;
  closePercent: number | null;
  closeAnswered: number;
  closed: number;
  noContact: number;
  openAlerts: number;
  /** Conversas R0: o cliente voltou a escrever e ficou sem resposta. */
  customerReturned: number;
};

function timestamp(value: Date | string | null) {
  if (value === null) return null;
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(result) ? result : null;
}

function answerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function percentage(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 100) : null;
}

export function aggregatePostSaleBrokerReport(input: {
  brokers: PostSaleReportBroker[];
  surveys: PostSaleReportSurvey[];
  from: Date;
  to: Date;
  /** Só as pesquisas de uma origem: manual, R0 ou uma regra da régua (R1 a R5). Padrão: todas. */
  ruleFilter?: PostSaleRuleFilter;
}): PostSaleBrokerReportRow[] {
  const rows = new Map<string, PostSaleBrokerReportRow>();
  const names = new Map(input.brokers.map((broker) => [broker.id, broker.name]));
  const ensure = (brokerId: string) => {
    const existing = rows.get(brokerId);
    if (existing) return existing;
    const created: PostSaleBrokerReportRow = {
      brokerId,
      brokerName: names.get(brokerId) ?? "Corretor sem cadastro ativo",
      sent: 0,
      responded: 0,
      attendancePercent: null,
      attendanceAnswered: 0,
      attended: 0,
      averageRating: null,
      ratingCount: 0,
      ratingTotal: 0,
      closePercent: null,
      closeAnswered: 0,
      closed: 0,
      noContact: 0,
      openAlerts: 0,
      customerReturned: 0,
    };
    rows.set(brokerId, created);
    return created;
  };

  for (const broker of input.brokers) ensure(broker.id);
  const from = input.from.getTime();
  const to = input.to.getTime();
  const ratingSums = new Map<string, { total: number; count: number }>();

  for (const survey of input.surveys) {
    if (!survey.brokerId) continue;
    if (!matchesPostSaleRuleFilter(survey.ruleKey, input.ruleFilter ?? "all")) continue;
    const sentAt = timestamp(survey.sentAt);
    if (sentAt === null || sentAt < from || sentAt >= to) continue;
    const row = ensure(survey.brokerId);
    const answers = answerRecord(survey.answers);
    const openAlert = isPostSaleAlertOpen({ ...survey, alertsHandledAt: survey.alertsHandledAt ? new Date(survey.alertsHandledAt) : null });
    if (survey.ruleKey === "R0") {
      row.customerReturned += 1;
      if (openAlert) row.openAlerts += 1;
      continue;
    }
    row.sent += 1;
    if (timestamp(survey.lastReplyAt) !== null) row.responded += 1;
    if (answers.contacted === true || answers.contacted === false) {
      row.attendanceAnswered += 1;
      if (answers.contacted) row.attended += 1;
    }
    if (answers.contacted === false || survey.outcome === "no_contact") row.noContact += 1;
    if (answers.closed === "yes" || answers.closed === "no" || answers.closed === "deciding") {
      row.closeAnswered += 1;
      if (answers.closed === "yes") row.closed += 1;
    }
    if (typeof survey.rating === "number" && survey.rating >= 1 && survey.rating <= 5) {
      const rating = ratingSums.get(survey.brokerId) ?? { total: 0, count: 0 };
      rating.total += survey.rating;
      rating.count += 1;
      ratingSums.set(survey.brokerId, rating);
    }
    if (openAlert) row.openAlerts += 1;
  }

  for (const row of rows.values()) {
    row.attendancePercent = percentage(row.attended, row.attendanceAnswered);
    row.closePercent = percentage(row.closed, row.closeAnswered);
    const rating = ratingSums.get(row.brokerId);
    row.averageRating = rating ? Math.round((rating.total / rating.count) * 10) / 10 : null;
    row.ratingCount = rating?.count ?? 0;
    row.ratingTotal = rating?.total ?? 0;
  }

  return [...rows.values()].sort((a, b) => a.brokerName.localeCompare(b.brokerName, "pt-BR"));
}

export type PostSaleReportSummary = {
  sent: number;
  responded: number;
  attendancePercent: number | null;
  averageRating: number | null;
  openAlerts: number;
};

/** Faixa de números da Visão geral: soma os corretores e pondera % atendido e nota pelo que foi respondido. */
export function summarizePostSaleReport(rows: readonly PostSaleBrokerReportRow[], openAlerts: number): PostSaleReportSummary {
  let sent = 0, responded = 0, attended = 0, attendanceAnswered = 0, ratingTotal = 0, ratingCount = 0;
  for (const row of rows) {
    sent += row.sent;
    responded += row.responded;
    attended += row.attended;
    attendanceAnswered += row.attendanceAnswered;
    ratingTotal += row.ratingTotal ?? 0;
    ratingCount += row.ratingCount ?? 0;
  }
  return {
    sent,
    responded,
    attendancePercent: percentage(attended, attendanceAnswered),
    averageRating: ratingCount ? Math.round((ratingTotal / ratingCount) * 10) / 10 : null,
    openAlerts,
  };
}
