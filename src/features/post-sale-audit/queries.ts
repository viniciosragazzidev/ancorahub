import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { isPostSaleAlertOpen, postSaleAlertDetail, postSaleAlertReasons } from "./alert-rules";
import type { PostSaleSurveyRow } from "./overview";
import type { PostSaleRuleFilter } from "./auto-rules";
import { aggregatePostSaleBrokerReport, type PostSaleBrokerReportRow, type PostSaleReportBroker, type PostSaleReportSurvey } from "./reporting";

export type PostSaleReportWindow = { from: Date; to: Date };

export type PostSaleOpenAlert = {
  surveyId: string;
  leadId: string;
  leadName: string;
  brokerName: string;
  /** Corretor da pesquisa: o nome vira link para o perfil dele. */
  brokerId?: string | null;
  reasons: ReturnType<typeof postSaleAlertReasons>;
  /** Detalhe por motivo: divergência de perda ("Corretor: ... Cliente: ..."), horário pedido, fala da reclamação. */
  detail: string | null;
  occurredAt: string;
};

function alertDetailOf(reasons: ReturnType<typeof postSaleAlertReasons>, answers: unknown) {
  return reasons.map((reason) => postSaleAlertDetail(reason, answers)).filter(Boolean).join(" · ") || null;
}

function branchWhere(context: TenantContext) {
  if (context.role !== "manager") return undefined;
  if (!context.branchId) return sql`false`;
  return sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${context.branchId}`;
}

function canReadPostSale(context: TenantContext) {
  return (context.role === "director" || context.role === "manager") && (context.role !== "manager" || Boolean(context.branchId));
}

export async function loadPostSaleBrokerReport(context: TenantContext, window: PostSaleReportWindow, ruleFilter: PostSaleRuleFilter = "all"): Promise<PostSaleBrokerReportRow[]> {
  if (!canReadPostSale(context)) return [];
  const db = getDatabase();
  const branchFilter = branchWhere(context);
  const [brokerRows, surveyRows] = await Promise.all([
    db.select({ id: schema.tenantMemberships.userId, name: schema.user.name })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
        eq(schema.user.active, true),
        eq(schema.user.status, "active"),
        context.role === "manager" ? eq(schema.tenantMemberships.branchId, context.branchId!) : undefined,
      ))
      .orderBy(schema.user.name),
    db.select({
      brokerId: schema.postSaleSurveys.brokerId,
      brokerName: schema.user.name,
      sentAt: schema.postSaleSurveys.sentAt,
      lastReplyAt: schema.postSaleSurveys.lastReplyAt,
      outcome: schema.postSaleSurveys.outcome,
      rating: schema.postSaleSurveys.rating,
      answers: schema.postSaleSurveys.answers,
      alertsHandledAt: schema.postSaleSurveys.alertsHandledAt,
      ruleKey: schema.postSaleSurveys.ruleKey,
    })
      .from(schema.postSaleSurveys)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
      .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
      .leftJoin(schema.user, eq(schema.user.id, schema.postSaleSurveys.brokerId))
      .where(and(
        eq(schema.postSaleSurveys.tenantId, context.tenantId),
        isNotNull(schema.postSaleSurveys.sentAt),
        gte(schema.postSaleSurveys.sentAt, window.from),
        lt(schema.postSaleSurveys.sentAt, window.to),
        isNull(schema.leads.deletedAt),
        branchFilter,
      ))
      .orderBy(desc(schema.postSaleSurveys.sentAt)),
  ]);

  const brokers = new Map<string, string>();
  for (const broker of brokerRows) brokers.set(broker.id, broker.name ?? "Corretor");
  for (const survey of surveyRows) {
    if (survey.brokerId && !brokers.has(survey.brokerId)) brokers.set(survey.brokerId, survey.brokerName ?? "Corretor sem cadastro ativo");
  }
  const identities: PostSaleReportBroker[] = [...brokers].map(([id, name]) => ({ id, name }));
  const surveys: PostSaleReportSurvey[] = surveyRows.map((survey) => ({
    brokerId: survey.brokerId,
    sentAt: survey.sentAt,
    lastReplyAt: survey.lastReplyAt,
    outcome: survey.outcome,
    rating: survey.rating,
    answers: survey.answers,
    alertsHandledAt: survey.alertsHandledAt,
    ruleKey: survey.ruleKey,
  }));
  return aggregatePostSaleBrokerReport({ brokers: identities, surveys, from: window.from, to: window.to, ruleFilter });
}

export async function loadPostSaleBrokerSummary(context: TenantContext, brokerId: string, window: PostSaleReportWindow): Promise<PostSaleBrokerReportRow | null> {
  if (!canReadPostSale(context)) return null;
  const db = getDatabase();
  const [membership] = await db.select({ id: schema.tenantMemberships.userId, name: schema.user.name })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.userId, brokerId),
      eq(schema.tenantMemberships.role, "broker"),
      context.role === "manager" ? eq(schema.tenantMemberships.branchId, context.branchId!) : undefined,
    ))
    .limit(1);
  if (!membership) return null;

  const report = await loadPostSaleBrokerReport(context, window);
  return report.find((row) => row.brokerId === brokerId) ?? {
    brokerId,
    brokerName: membership.name ?? "Corretor",
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
}

export async function loadPostSaleOpenAlerts(context: TenantContext): Promise<PostSaleOpenAlert[]> {
  if (!canReadPostSale(context)) return [];
  const db = getDatabase();
  const rows = await db.select({
    surveyId: schema.postSaleSurveys.id,
    leadId: schema.postSaleSurveys.leadId,
    leadName: schema.leads.nome,
    brokerId: schema.postSaleSurveys.brokerId,
    brokerName: schema.user.name,
    outcome: schema.postSaleSurveys.outcome,
    rating: schema.postSaleSurveys.rating,
    answers: schema.postSaleSurveys.answers,
    sentAt: schema.postSaleSurveys.sentAt,
    lastReplyAt: schema.postSaleSurveys.lastReplyAt,
    completedAt: schema.postSaleSurveys.completedAt,
    createdAt: schema.postSaleSurveys.createdAt,
  })
    .from(schema.postSaleSurveys)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.user, eq(schema.user.id, schema.postSaleSurveys.brokerId))
    .where(and(
      eq(schema.postSaleSurveys.tenantId, context.tenantId),
      isNull(schema.postSaleSurveys.alertsHandledAt),
      isNull(schema.leads.deletedAt),
      or(
        inArray(schema.postSaleSurveys.outcome, ["no_contact", "bad_service", "r0_not_attended"]),
        sql`${schema.postSaleSurveys.answers}->'r0'->>'escalatedAt' is not null`,
        sql`${schema.postSaleSurveys.rating} <= 2`,
        sql`${schema.postSaleSurveys.answers}->>'sentiment' = 'negative'`,
        sql`${schema.postSaleSurveys.answers}->>'wantsHelp' = 'true'`,
        sql`${schema.postSaleSurveys.answers}->'lossCheck'->>'divergent' = 'true'`,
        sql`jsonb_exists_any(coalesce(${schema.postSaleSurveys.answers}->'intents'->'list', '[]'::jsonb), array['price_request', 'wants_human', 'scheduling', 'complaint', 'health_urgency'])`,
      ),
      branchWhere(context),
    ))
    .orderBy(desc(sql`coalesce(${schema.postSaleSurveys.lastReplyAt}, ${schema.postSaleSurveys.completedAt}, ${schema.postSaleSurveys.sentAt}, ${schema.postSaleSurveys.createdAt})`))
    // Room for the open-alerts KPI to stay exact at the current volume (it stopped at 200; Vigia, 09/11).
    .limit(1000);

  return rows.flatMap((row) => {
    const reasons = postSaleAlertReasons(row);
    if (!reasons.length) return [];
    const occurredAt = row.lastReplyAt ?? row.completedAt ?? row.sentAt ?? row.createdAt;
    return [{ surveyId: row.surveyId, leadId: row.leadId, leadName: row.leadName ?? "Lead", brokerName: row.brokerName ?? "Sem corretor", brokerId: row.brokerName ? row.brokerId : null, reasons, detail: alertDetailOf(reasons, row.answers), occurredAt: occurredAt.toISOString() }];
  });
}

export async function loadLatestPostSaleLeadSurvey(context: TenantContext, leadId: string) {
  if (!canReadPostSale(context)) return null;
  const db = getDatabase();
  const [survey] = await db.select({
    id: schema.postSaleSurveys.id,
    leadId: schema.postSaleSurveys.leadId,
    status: schema.postSaleSurveys.status,
    outcome: schema.postSaleSurveys.outcome,
    rating: schema.postSaleSurveys.rating,
    answers: schema.postSaleSurveys.answers,
    sentAt: schema.postSaleSurveys.sentAt,
    lastReplyAt: schema.postSaleSurveys.lastReplyAt,
    completedAt: schema.postSaleSurveys.completedAt,
    createdAt: schema.postSaleSurveys.createdAt,
  })
    .from(schema.postSaleSurveys)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .where(and(
      eq(schema.postSaleSurveys.tenantId, context.tenantId),
      eq(schema.postSaleSurveys.leadId, leadId),
      isNull(schema.leads.deletedAt),
      branchWhere(context),
    ))
    .orderBy(desc(sql`coalesce(${schema.postSaleSurveys.lastReplyAt}, ${schema.postSaleSurveys.sentAt}, ${schema.postSaleSurveys.createdAt})`))
    .limit(1);
  return survey ?? null;
}
export async function loadPostSaleAlertTarget(context: TenantContext, surveyId: string) {
  if (!canReadPostSale(context)) return null;
  const db = getDatabase();
  const [survey] = await db.select({ id: schema.postSaleSurveys.id, leadId: schema.postSaleSurveys.leadId, alertsHandledAt: schema.postSaleSurveys.alertsHandledAt, outcome: schema.postSaleSurveys.outcome, rating: schema.postSaleSurveys.rating, answers: schema.postSaleSurveys.answers })
    .from(schema.postSaleSurveys)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .where(and(eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.id, surveyId), isNull(schema.leads.deletedAt), branchWhere(context)))
    .limit(1);
  return survey ?? null;
}


/**
 * Pesquisas do período para a tela Equipe › Pós-venda (24/11): uma linha por lead e régua, com entrega e
 * leitura da abertura (outbox). Inclui as que ainda estão na fila, falharam ou não saíram. As contas são
 * feitas na tela (`overview.ts`).
 */
export async function loadPostSaleSurveyRows(context: TenantContext, window: PostSaleReportWindow, limit = 3000): Promise<PostSaleSurveyRow[]> {
  if (!canReadPostSale(context)) return [];
  const db = getDatabase();
  const at = sql`coalesce(${schema.postSaleSurveys.sentAt}, ${schema.postSaleSurveys.createdAt})`;
  const rows = await db.select({
    id: schema.postSaleSurveys.id,
    leadId: schema.postSaleSurveys.leadId,
    leadName: schema.leads.nome,
    brokerId: schema.postSaleSurveys.brokerId,
    brokerName: schema.user.name,
    campaignId: schema.postSaleSurveys.campaignId,
    campaignName: schema.postSaleCampaigns.name,
    ruleKey: schema.postSaleSurveys.ruleKey,
    status: schema.postSaleSurveys.status,
    outcome: schema.postSaleSurveys.outcome,
    rating: schema.postSaleSurveys.rating,
    answers: schema.postSaleSurveys.answers,
    skipReason: schema.postSaleSurveys.skipReason,
    createdAt: schema.postSaleSurveys.createdAt,
    sentAt: schema.postSaleSurveys.sentAt,
    deliveredAt: schema.whatsappOutboundMessages.deliveredAt,
    readAt: schema.whatsappOutboundMessages.readAt,
    lastReplyAt: schema.postSaleSurveys.lastReplyAt,
    completedAt: schema.postSaleSurveys.completedAt,
    alertsHandledAt: schema.postSaleSurveys.alertsHandledAt,
  })
    .from(schema.postSaleSurveys)
    .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
    .innerJoin(schema.postSaleCampaigns, and(eq(schema.postSaleCampaigns.id, schema.postSaleSurveys.campaignId), eq(schema.postSaleCampaigns.tenantId, schema.postSaleSurveys.tenantId)))
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.user, eq(schema.user.id, schema.postSaleSurveys.brokerId))
    .leftJoin(schema.whatsappOutboundMessages, eq(schema.whatsappOutboundMessages.id, schema.postSaleSurveys.outboundId))
    .where(and(
      eq(schema.postSaleSurveys.tenantId, context.tenantId),
      // `at` is raw SQL: Drizzle does not map the Date, and postgres-js refuses a Date param here (24/11: the
      // whole Pós-venda page fell to "Acesso negado"). Pass ISO text cast to timestamptz.
      sql`${at} >= ${window.from.toISOString()}::timestamptz`,
      sql`${at} < ${window.to.toISOString()}::timestamptz`,
      isNull(schema.leads.deletedAt),
      branchWhere(context),
    ))
    .orderBy(desc(at))
    .limit(limit);
  const iso = (value: Date | null) => value?.toISOString() ?? null;
  return rows.map((row) => {
    const answers = (row.answers ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      leadId: row.leadId,
      leadName: row.leadName ?? "Lead",
      brokerId: row.brokerId,
      brokerName: row.brokerName ?? null,
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      ruleKey: row.ruleKey,
      status: row.status,
      outcome: row.outcome,
      rating: row.rating,
      answers,
      skipReason: row.skipReason,
      createdAt: row.createdAt.toISOString(),
      sentAt: iso(row.sentAt),
      deliveredAt: iso(row.deliveredAt),
      readAt: iso(row.readAt),
      lastReplyAt: iso(row.lastReplyAt),
      completedAt: iso(row.completedAt),
      alertOpen: isPostSaleAlertOpen({ outcome: row.outcome, rating: row.rating, answers, alertsHandledAt: row.alertsHandledAt }),
    };
  });
}
