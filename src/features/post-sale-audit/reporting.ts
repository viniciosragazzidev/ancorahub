import { isPostSaleAlertOpen } from "./alert-rules";

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
  }

  return [...rows.values()].sort((a, b) => a.brokerName.localeCompare(b.brokerName, "pt-BR"));
}
