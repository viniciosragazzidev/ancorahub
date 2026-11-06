"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { enqueueMetaTemplateMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { isBusinessHours, nextBusinessOpening } from "@/features/team-notices/guard";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { loadLatestPostSaleLeadSurvey, loadPostSaleAlertTarget, loadPostSaleBrokerReport, loadPostSaleBrokerSummary, loadPostSaleOpenAlerts } from "./queries";
import { postSaleAlertReasons } from "./alert-rules";
import type { PostSaleBrokerReportRow } from "./reporting";
import { firstName, findUnknownPostSaleOpeningVariables, renderPostSaleOpeningMessage } from "./rules";
import { postSaleAudienceSchema, POST_SALE_CAMPAIGN_MAX_LEADS } from "./rules";
import { resolvePostSaleAudience } from "./audience";
import { POST_SALE_META_TEMPLATE, POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";

const campaignInput = z.object({
  name: z.string().trim().min(2, "Informe o nome da campanha.").max(120),
  audience: z.unknown(),
  openingMessage: z.string().trim().min(20, "A apresentação precisa ter pelo menos 20 caracteres.").max(4096),
});

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

class PostSaleActionError extends Error {}

async function authorizedContext() {
  if (await getFeatureFlag(FEATURE_FLAGS.POST_SALE_AUDIT).catch(() => "false") !== "true") {
    throw new PostSaleActionError("A auditoria de pós-venda está desligada.");
  }
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") throw new PostSaleActionError("Apenas diretores e gestores podem operar campanhas de pós-venda.");
  if (context.role === "manager" && !context.branchId) throw new PostSaleActionError("Seu usuário não tem unidade definida.");
  const canAccess = await hasEffectiveCapability({
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId ?? null,
    permission: "acessar_leads",
  });
  if (!canAccess) throw new PostSaleActionError("Seu perfil não tem acesso aos leads.");
  return context;
}

function safeFailure(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Confira os campos da campanha.";
  if (error instanceof PostSaleActionError) return error.message;
  console.error("[post-sale-audit] action failed", error);
  return "Não foi possível concluir a operação agora.";
}

async function recordPostSaleAudit(input: {
  tenantId: string;
  userId: string;
  campaignId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await recordPostSaleAuditEvent({
    tenantId: input.tenantId,
    userId: input.userId,
    entity: "post_sale_campaign",
    entityId: input.campaignId,
    action: input.action,
    metadata: input.metadata,
  });
}

async function recordPostSaleAuditEvent(input: {
  tenantId: string;
  userId: string;
  entity: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: input.userId,
    entidade: input.entity,
    entidadeId: input.entityId,
    acao: input.action,
    metadata: { source: "post_sale_audit", tenantId: input.tenantId, ...(input.metadata ?? {}) },
  });
}

async function campaignIsInManagerBranch(tenantId: string, branchId: string | null, audience: ReturnType<typeof postSaleAudienceSchema.parse>) {
  if (!branchId) return false;
  const db = getDatabase();
  if (audience.kind === "broker") {
    const [membership] = await db.select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships).where(and(
      eq(schema.tenantMemberships.tenantId, tenantId), eq(schema.tenantMemberships.userId, audience.brokerId),
      eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.tenantMemberships.branchId, branchId),
    )).limit(1);
    return Boolean(membership);
  }
  if (audience.kind === "filters") {
    if (audience.branchId !== branchId) return false;
    if (!audience.queueId) return true;
    const [queue] = await db.select({ branchId: schema.leadQueues.branchId }).from(schema.leadQueues).where(and(
      eq(schema.leadQueues.id, audience.queueId), eq(schema.leadQueues.tenantId, tenantId), isNull(schema.leadQueues.deletedAt),
    )).limit(1);
    return Boolean(queue && (!queue.branchId || queue.branchId === branchId));
  }
  const ids = audience.kind === "lead" ? [audience.leadId] : audience.kind === "leadIds" ? [...new Set(audience.leadIds)] : [];
  if (!ids.length) return false;
  const rows = await db.select({ id: schema.leads.id }).from(schema.leads)
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
    .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.id, ids), sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${branchId}`));
  return rows.length === ids.length;
}

export async function previewPostSaleAudienceAction(rawAudience: unknown): Promise<ActionResult<{
  totalSelected: number;
  totalEligible: number;
  canStart: boolean;
  excluded: Record<string, number>;
  examples: Array<{ leadId: string; name: string; channelType: "waha" | "meta" }>;
}>> {
  try {
    const context = await authorizedContext();
    const audience = postSaleAudienceSchema.parse(rawAudience);
    const preview = await resolvePostSaleAudience(context, audience);
    await recordPostSaleAudit({
      tenantId: context.tenantId,
      userId: context.userId,
      campaignId: "preview",
      action: "post_sale_campaign.previewed",
      metadata: { totalSelected: preview.totalSelected, totalEligible: preview.totalEligible, excluded: preview.excluded },
    });
    return { ok: true, data: { totalSelected: preview.totalSelected, totalEligible: preview.totalEligible, canStart: preview.canStart, excluded: preview.excluded, examples: preview.examples } };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

export async function createPostSaleCampaignAction(rawInput: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const context = await authorizedContext();
    const parsed = campaignInput.parse(rawInput);
    const requestedAudience = postSaleAudienceSchema.parse(parsed.audience);
    const audience = context.role === "manager" && requestedAudience.kind === "filters"
      ? { ...requestedAudience, branchId: context.branchId! }
      : requestedAudience;
    const unknownVariables = findUnknownPostSaleOpeningVariables(parsed.openingMessage);
    if (unknownVariables.length) throw new PostSaleActionError(`Variável não reconhecida: {{${unknownVariables[0]}}}.`);
    const preview = await resolvePostSaleAudience(context, audience);
    if (!preview.totalEligible) throw new PostSaleActionError("Nenhum lead está elegível para esta campanha.");
    if (!preview.canStart) throw new PostSaleActionError(`A campanha pode ter no máximo ${POST_SALE_CAMPAIGN_MAX_LEADS} leads elegíveis.`);
    const id = randomUUID();
    await getDatabase().insert(schema.postSaleCampaigns).values({
      id,
      tenantId: context.tenantId,
      name: parsed.name,
      audience: { ...audience },
      openingMessage: parsed.openingMessage,
      createdBy: context.userId,
      status: "draft",
      totals: { selected: preview.totalSelected, eligible: preview.totalEligible },
      createdAt: new Date(),
    });
    await recordPostSaleAudit({ tenantId: context.tenantId, userId: context.userId, campaignId: id, action: "post_sale_campaign.created", metadata: { audienceKind: audience.kind } });
    return { ok: true, data: { id } };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

function scheduledOpening(now: Date) {
  return isBusinessHours(now) ? undefined : nextBusinessOpening(now);
}

export async function startPostSaleCampaignAction(campaignId: string): Promise<ActionResult<{ queued: number; skipped: number; failed: number }>> {
  try {
    const context = await authorizedContext();
    const validId = z.string().trim().min(1).max(80).parse(campaignId);
    const db = getDatabase();
    const [campaign] = await db.select().from(schema.postSaleCampaigns).where(and(
      eq(schema.postSaleCampaigns.id, validId),
      eq(schema.postSaleCampaigns.tenantId, context.tenantId),
    )).limit(1);
    if (!campaign) throw new PostSaleActionError("Campanha não encontrada.");
    if (context.role === "manager" && campaign.createdBy !== context.userId) {
      const savedAudience = postSaleAudienceSchema.parse(campaign.audience);
      if (!(await campaignIsInManagerBranch(context.tenantId, context.branchId, savedAudience))) {
        throw new PostSaleActionError("Esta campanha não pertence à sua unidade.");
      }
    }
    if (campaign.status !== "draft" && campaign.status !== "running") throw new PostSaleActionError("Esta campanha não pode ser iniciada novamente.");
    const audience = postSaleAudienceSchema.parse(campaign.audience);
    const preview = await resolvePostSaleAudience(context, audience);
    if (!preview.totalEligible) throw new PostSaleActionError("Nenhum lead está elegível para esta campanha.");
    if (!preview.canStart) throw new PostSaleActionError(`A campanha pode ter no máximo ${POST_SALE_CAMPAIGN_MAX_LEADS} leads elegíveis.`);

    if (campaign.status === "draft") {
      const [started] = await db.update(schema.postSaleCampaigns).set({ status: "running", startedAt: new Date() }).where(and(
        eq(schema.postSaleCampaigns.id, campaign.id),
        eq(schema.postSaleCampaigns.tenantId, context.tenantId),
        eq(schema.postSaleCampaigns.status, "draft"),
      )).returning({ id: schema.postSaleCampaigns.id });
      if (!started) {
        const [current] = await db.select({ status: schema.postSaleCampaigns.status }).from(schema.postSaleCampaigns).where(and(eq(schema.postSaleCampaigns.id, campaign.id), eq(schema.postSaleCampaigns.tenantId, context.tenantId))).limit(1);
        if (current?.status !== "running") throw new PostSaleActionError("A campanha mudou de estado. Atualize e tente novamente.");
      }
    }

    const now = new Date();
    const [flags] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
    const [config] = await db.select({ assistantName: schema.aiQualificationConfigs.assistantName }).from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId)).limit(1);
    const brokerIds = [...new Set([...preview.recipients, ...preview.skippedRecipients].map((recipient) => recipient.brokerId))];
    const brokerRows = brokerIds.length ? await db.select({ id: schema.user.id, name: schema.user.name })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        inArray(schema.tenantMemberships.userId, brokerIds),
      )) : [];
    const brokerNames = new Map(brokerRows.map((broker) => [broker.id, firstName(broker.name)]));
    const companyName = flags?.name?.trim() || "nossa equipe";
    const assistantName = config?.assistantName?.trim() || "equipe de qualidade";
    const scheduledAt = scheduledOpening(now);
    let queued = 0;
    let skipped = 0;
    let failed = 0;

    for (const recipient of preview.skippedRecipients) {
      await db.insert(schema.postSaleSurveys).values({
        id: randomUUID(), tenantId: context.tenantId, campaignId: campaign.id, leadId: recipient.leadId, brokerId: recipient.brokerId,
        phone: recipient.phone, status: "skipped", step: 0, answers: {}, channelType: recipient.channelType, channelRef: recipient.channelRef,
        skipReason: recipient.reason === "template_unapproved" ? "template de pós-venda ainda não aprovado" : "número de origem indisponível", createdAt: now,
      }).onConflictDoNothing({ target: [schema.postSaleSurveys.tenantId, schema.postSaleSurveys.campaignId, schema.postSaleSurveys.leadId] });
      skipped += 1;
    }

    for (const recipient of preview.recipients) {
      const surveyId = randomUUID();
      await db.insert(schema.postSaleSurveys).values({
        id: surveyId, tenantId: context.tenantId, campaignId: campaign.id, leadId: recipient.leadId, brokerId: recipient.brokerId,
        phone: recipient.phone, status: "queued", step: 0, answers: {}, channelType: recipient.channelType, channelRef: recipient.channelRef, createdAt: now,
      }).onConflictDoNothing({ target: [schema.postSaleSurveys.tenantId, schema.postSaleSurveys.campaignId, schema.postSaleSurveys.leadId] });
      const idempotencyKey = `post-sale:${campaign.id}:${recipient.leadId}`;
      const brokerName = brokerNames.get(recipient.brokerId) ?? "nosso corretor";
      try {
        const outbound = recipient.channelType === "waha"
          ? await enqueuePostSaleSurveyWahaMessage({
            tenantId: context.tenantId,
            leadId: recipient.leadId,
            wahaNumberId: recipient.channelRef,
            destinationPhone: recipient.phone,
            body: renderPostSaleOpeningMessage(campaign.openingMessage || POST_SALE_WAHA_OPENING_DEFAULT, {
              nome: firstName(recipient.name), assistente: assistantName, empresa: companyName, corretor: brokerName,
            }),
            requestedBy: context.userId,
            idempotencyKey,
            scheduledAt,
          })
          : await enqueueMetaTemplateMessage({
            tenantId: context.tenantId,
            channelId: recipient.channelRef,
            recipientType: "lead",
            recipientId: recipient.leadId,
            destinationPhone: recipient.phone,
            purpose: "postSaleSurvey",
            variables: [firstName(recipient.name), companyName, brokerName],
            requestedBy: context.userId,
            idempotencyKey,
            scheduledAt,
            requireApprovedMetaTemplate: true,
            templateName: POST_SALE_META_TEMPLATE.name,
            strictSourceChannel: true,
          });
        await db.update(schema.postSaleSurveys).set({ outboundId: outbound.id }).where(and(
          eq(schema.postSaleSurveys.tenantId, context.tenantId),
          eq(schema.postSaleSurveys.campaignId, campaign.id),
          eq(schema.postSaleSurveys.leadId, recipient.leadId),
        ));
        if (["failed", "cancelled", "expired"].includes(outbound.status)) {
          await db.update(schema.postSaleSurveys).set({ status: "failed", skipReason: "falha ao enfileirar o canal de origem" }).where(and(eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.campaignId, campaign.id), eq(schema.postSaleSurveys.leadId, recipient.leadId)));
          failed += 1;
        } else if (outbound.status === "skipped") {
          await db.update(schema.postSaleSurveys).set({ status: "skipped", skipReason: "número de origem indisponível" }).where(and(eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.campaignId, campaign.id), eq(schema.postSaleSurveys.leadId, recipient.leadId)));
          skipped += 1;
        } else {
          queued += 1;
        }
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
        const reason = code === "POST_SALE_SOURCE_UNAVAILABLE" || code === "META_CHANNEL_UNAVAILABLE" || code === "FIRST_CONTACT_TEMPLATE_UNAVAILABLE"
          ? (code === "FIRST_CONTACT_TEMPLATE_UNAVAILABLE" ? "template de pós-venda ainda não aprovado" : "número de origem indisponível")
          : "falha ao enfileirar o canal de origem";
        const status = reason.includes("template") || reason.includes("número") ? "skipped" : "failed";
        await db.update(schema.postSaleSurveys).set({ status, skipReason: reason }).where(and(
          eq(schema.postSaleSurveys.tenantId, context.tenantId),
          eq(schema.postSaleSurveys.campaignId, campaign.id),
          eq(schema.postSaleSurveys.leadId, recipient.leadId),
        ));
        if (status === "skipped") skipped += 1;
        else failed += 1;
      }
    }

    const totals = { selected: preview.totalSelected, eligible: preview.totalEligible, queued, skipped, failed, excluded: preview.totalSelected - preview.totalEligible - preview.skippedRecipients.length };
    await db.update(schema.postSaleCampaigns).set({ totals }).where(and(eq(schema.postSaleCampaigns.id, campaign.id), eq(schema.postSaleCampaigns.tenantId, context.tenantId)));
    await recordPostSaleAudit({ tenantId: context.tenantId, userId: context.userId, campaignId: campaign.id, action: "post_sale_campaign.started", metadata: { ...totals } });
    return { ok: true, data: { queued, skipped, failed } };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

const postSalePeriodSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);

function postSaleWindow(periodDays: number, now = new Date()) {
  return { from: new Date(now.getTime() - periodDays * 86_400_000), to: new Date(now.getTime() + 1) };
}

export async function getPostSaleWorkspaceAction(rawPeriodDays: unknown = 30): Promise<ActionResult<{
  brokers: Array<{ id: string; name: string }>;
  queues: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; status: string; totals: Record<string, number>; createdAt: string }>;
  responses: Array<{ id: string; leadId: string; leadName: string; campaignName: string; status: string; rating: number | null; answers: Record<string, unknown>; lastReplyAt: string | null }>;
  report: PostSaleBrokerReportRow[];
  alerts: Awaited<ReturnType<typeof loadPostSaleOpenAlerts>>;
  periodDays: number;
}>> {
  try {
    const context = await authorizedContext();
    const periodDays = postSalePeriodSchema.parse(rawPeriodDays);
    const window = postSaleWindow(periodDays);
    const db = getDatabase();
    const branchFilter = context.role === "manager" ? context.branchId : undefined;
    const [brokers, queues, campaigns, responses, report, alerts] = await Promise.all([
      db.select({ id: schema.tenantMemberships.userId, name: schema.user.name }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), branchFilter ? eq(schema.tenantMemberships.branchId, branchFilter) : undefined))
        .orderBy(schema.user.name),
      db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name }).from(schema.leadQueues).where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"), isNull(schema.leadQueues.deletedAt), branchFilter ? or(eq(schema.leadQueues.branchId, branchFilter), isNull(schema.leadQueues.branchId)) : undefined)).orderBy(schema.leadQueues.name),
      db.select({ id: schema.postSaleCampaigns.id, name: schema.postSaleCampaigns.name, status: schema.postSaleCampaigns.status, totals: schema.postSaleCampaigns.totals, createdAt: schema.postSaleCampaigns.createdAt }).from(schema.postSaleCampaigns)
        .where(and(eq(schema.postSaleCampaigns.tenantId, context.tenantId), context.role === "manager" ? eq(schema.postSaleCampaigns.createdBy, context.userId) : undefined))
        .orderBy(desc(schema.postSaleCampaigns.createdAt)).limit(20),
      db.select({ id: schema.postSaleSurveys.id, leadId: schema.postSaleSurveys.leadId, leadName: schema.leads.nome, campaignName: schema.postSaleCampaigns.name, status: schema.postSaleSurveys.status, rating: schema.postSaleSurveys.rating, answers: schema.postSaleSurveys.answers, lastReplyAt: schema.postSaleSurveys.lastReplyAt, createdAt: schema.postSaleSurveys.createdAt })
        .from(schema.postSaleSurveys)
        .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
        .innerJoin(schema.postSaleCampaigns, and(eq(schema.postSaleCampaigns.id, schema.postSaleSurveys.campaignId), eq(schema.postSaleCampaigns.tenantId, schema.postSaleSurveys.tenantId)))
        .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
        .where(and(eq(schema.postSaleSurveys.tenantId, context.tenantId), isNull(schema.leads.deletedAt), branchFilter ? sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${branchFilter}` : undefined))
        .orderBy(desc(schema.postSaleSurveys.lastReplyAt), desc(schema.postSaleSurveys.createdAt)).limit(100),
      loadPostSaleBrokerReport(context, window),
      loadPostSaleOpenAlerts(context),
    ]);
    await recordPostSaleAuditEvent({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_report", entityId: "workspace", action: "post_sale_report.viewed", metadata: { periodDays, brokerRows: report.length, openAlerts: alerts.length } });
    return { ok: true, data: {
      brokers: brokers.map((row) => ({ id: row.id, name: row.name ?? "Corretor" })),
      queues,
      campaigns: campaigns.map((row) => ({ ...row, totals: row.totals as Record<string, number>, createdAt: row.createdAt.toISOString() })),
      responses: responses.map((row) => ({ ...row, answers: row.answers as Record<string, unknown>, lastReplyAt: row.lastReplyAt?.toISOString() ?? null })),
      report,
      alerts,
      periodDays,
    } };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

export async function getPostSaleBrokerSummaryAction(rawBrokerId: unknown, rawPeriodDays: unknown = 30): Promise<ActionResult<PostSaleBrokerReportRow | null>> {
  try {
    const context = await authorizedContext();
    const brokerId = z.string().trim().min(1).max(80).parse(rawBrokerId);
    const periodDays = postSalePeriodSchema.parse(rawPeriodDays);
    const report = await loadPostSaleBrokerSummary(context, brokerId, postSaleWindow(periodDays));
    await recordPostSaleAuditEvent({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_report", entityId: brokerId, action: "post_sale_report.broker_viewed", metadata: { periodDays, available: Boolean(report) } });
    return { ok: true, data: report };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

export async function getPostSaleLeadSurveyAction(rawLeadId: unknown): Promise<ActionResult<{
  id: string;
  status: string;
  outcome: string | null;
  rating: number | null;
  answers: Record<string, unknown>;
  sentAt: string | null;
  lastReplyAt: string | null;
  completedAt: string | null;
} | null>> {
  try {
    const context = await authorizedContext();
    const leadId = z.string().trim().min(1).max(80).parse(rawLeadId);
    const survey = await loadLatestPostSaleLeadSurvey(context, leadId);
    if (!survey) return { ok: true, data: null };
    await recordPostSaleAuditEvent({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_survey", entityId: survey.id, action: "post_sale_survey.viewed", metadata: { leadId } });
    return { ok: true, data: {
      id: survey.id,
      status: survey.status,
      outcome: survey.outcome,
      rating: survey.rating,
      answers: survey.answers as Record<string, unknown>,
      sentAt: survey.sentAt?.toISOString() ?? null,
      lastReplyAt: survey.lastReplyAt?.toISOString() ?? null,
      completedAt: survey.completedAt?.toISOString() ?? null,
    } };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

export async function markPostSaleAlertHandledAction(rawSurveyId: unknown): Promise<ActionResult<{ changed: boolean }>> {
  try {
    const context = await authorizedContext();
    const surveyId = z.string().trim().min(1).max(80).parse(rawSurveyId);
    const target = await loadPostSaleAlertTarget(context, surveyId);
    if (!target) throw new PostSaleActionError("Alerta não encontrado ou fora do seu escopo.");
    if (target.alertsHandledAt) return { ok: true, data: { changed: false } };
    const reasons = postSaleAlertReasons(target);
    if (!reasons.length) return { ok: true, data: { changed: false } };

    const now = new Date();
    const managerScope = context.role === "manager" ? sql`exists (
      select 1
      from leads as post_sale_alert_lead
      left join lead_queues as post_sale_alert_queue
        on post_sale_alert_queue.id = post_sale_alert_lead.queue_id
        and post_sale_alert_queue.tenant_id = post_sale_alert_lead.tenant_id
      where post_sale_alert_lead.id = ${schema.postSaleSurveys.leadId}
        and post_sale_alert_lead.tenant_id = ${context.tenantId}
        and post_sale_alert_lead.deleted_at is null
        and coalesce(post_sale_alert_lead.branch_id, post_sale_alert_queue.branch_id) = ${context.branchId}
    )` : undefined;
    const changed = await getDatabase().transaction(async (tx) => {
      const [updated] = await tx.update(schema.postSaleSurveys).set({ alertsHandledAt: now }).where(and(
        eq(schema.postSaleSurveys.id, surveyId),
        eq(schema.postSaleSurveys.tenantId, context.tenantId),
        isNull(schema.postSaleSurveys.alertsHandledAt),
        managerScope,
      )).returning({ id: schema.postSaleSurveys.id });
      if (!updated) return false;

      await tx.update(schema.notifications).set({ readAt: now, message: "Alerta de pós-venda tratado pela gestão." }).where(and(
        eq(schema.notifications.tenantId, context.tenantId),
        eq(schema.notifications.leadId, target.leadId),
        eq(schema.notifications.type, "post_sale_alert"),
        sql`${schema.notifications.idempotencyKey} like ${`post-sale-alert:${surveyId}:%`}`,
        isNull(schema.notifications.readAt),
      ));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "post_sale_survey",
        entidadeId: surveyId,
        acao: "post_sale_alert.handled",
        metadata: { source: "post_sale_audit", tenantId: context.tenantId, leadId: target.leadId, reasons },
        createdAt: now,
      });
      return true;
    });
    return { ok: true, data: { changed } };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

