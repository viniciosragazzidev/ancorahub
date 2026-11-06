import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { postSaleAlertReasons } from "./alert-rules";
import { aggregatePostSaleBrokerReport, type PostSaleBrokerReportRow, type PostSaleReportBroker, type PostSaleReportSurvey } from "./reporting";

export type PostSaleReportWindow = { from: Date; to: Date };

export type PostSaleOpenAlert = {
  surveyId: string;
  leadId: string;
  leadName: string;
  brokerName: string;
  reasons: ReturnType<typeof postSaleAlertReasons>;
  occurredAt: string;
};

function branchWhere(context: TenantContext) {
  if (context.role !== "manager") return undefined;
  if (!context.branchId) return sql`false`;
  return sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${context.branchId}`;
}

function canReadPostSale(context: TenantContext) {
  return (context.role === "director" || context.role === "manager") && (context.role !== "manager" || Boolean(context.branchId));
}

export async function loadPostSaleBrokerReport(context: TenantContext, window: PostSaleReportWindow): Promise<PostSaleBrokerReportRow[]> {
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
  }));
  return aggregatePostSaleBrokerReport({ brokers: identities, surveys, from: window.from, to: window.to });
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
    closePercent: null,
    closeAnswered: 0,
    closed: 0,
    noContact: 0,
    openAlerts: 0,
  };
}

export async function loadPostSaleOpenAlerts(context: TenantContext): Promise<PostSaleOpenAlert[]> {
  if (!canReadPostSale(context)) return [];
  const db = getDatabase();
  const rows = await db.select({
    surveyId: schema.postSaleSurveys.id,
    leadId: schema.postSaleSurveys.leadId,
    leadName: schema.leads.nome,
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
        inArray(schema.postSaleSurveys.outcome, ["no_contact", "bad_service"]),
        sql`${schema.postSaleSurveys.rating} <= 2`,
        sql`${schema.postSaleSurveys.answers}->>'sentiment' = 'negative'`,
        sql`${schema.postSaleSurveys.answers}->>'wantsHelp' = 'true'`,
      ),
      branchWhere(context),
    ))
    .orderBy(desc(sql`coalesce(${schema.postSaleSurveys.lastReplyAt}, ${schema.postSaleSurveys.completedAt}, ${schema.postSaleSurveys.sentAt}, ${schema.postSaleSurveys.createdAt})`))
    .limit(200);

  return rows.flatMap((row) => {
    const reasons = postSaleAlertReasons(row);
    if (!reasons.length) return [];
    const occurredAt = row.lastReplyAt ?? row.completedAt ?? row.sentAt ?? row.createdAt;
    return [{ surveyId: row.surveyId, leadId: row.leadId, leadName: row.leadName ?? "Lead", brokerName: row.brokerName ?? "Sem corretor", reasons, occurredAt: occurredAt.toISOString() }];
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

