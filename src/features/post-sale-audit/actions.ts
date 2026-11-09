"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { enqueueMetaTemplateMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag, getSystemSetting, setSystemSetting } from "@/features/system-settings/queries";
import { isBusinessHours, nextBusinessOpening } from "@/features/team-notices/guard";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { loadLatestPostSaleLeadSurvey, loadPostSaleAlertTarget, loadPostSaleBrokerReport, loadPostSaleBrokerSummary, loadPostSaleOpenAlerts } from "./queries";
import { postSaleAlertReasons } from "./alert-rules";
import type { PostSaleBrokerReportRow } from "./reporting";
import { firstName, findUnknownPostSaleOpeningVariables, renderPostSaleOpeningMessage } from "./rules";
import { postSaleAudienceSchema, POST_SALE_CAMPAIGN_MAX_LEADS } from "./rules";
import { resolvePostSaleAudience } from "./audience";
import { canResumePostSaleNow } from "./conversation-rules";
import { sendPostSaleNudge } from "./conversation";
import { parseR0Settings, postSaleR0SettingKey, serializeR0Settings, type R0Settings } from "./r0-rules";
import { POST_SALE_META_TEMPLATE, POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";
import { autoRuleSettingsInputSchema, parsePostSaleRuleFilter, type AutoRuleSettings, type PostSaleRuleFilter } from "./auto-rules";
import { AutoRulesTableMissingError, loadAutoRules, saveAutoRule } from "./auto-rules-store";
import { previewAutoRule, type AutoRulePreview } from "./auto-sweep";
import { postSaleViewAuditId } from "./view-audit";
import { emptyPostSaleCampaignCounts, type PostSaleCampaignCounts, type PostSaleRetryResult } from "./campaign-retry";
import { loadPostSaleCampaignCounts, retryFailedPostSaleSurveys } from "./campaign-retry-service";

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
  if (error instanceof AutoRulesTableMissingError) return error.message;
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

/**
 * Auditoria de visualização com dedupe: no máximo uma linha por usuário, entidade e ação a cada hora
 * cheia (id determinístico + onConflictDoNothing), sem consulta extra.
 */
async function recordPostSaleViewAudit(input: {
  tenantId: string;
  userId: string;
  entity: string;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  await getDatabase().insert(schema.auditLogs).values({
    id: postSaleViewAuditId({ ...input, now }),
    userId: input.userId,
    entidade: input.entity,
    entidadeId: input.entityId,
    acao: input.action,
    metadata: { source: "post_sale_audit", tenantId: input.tenantId, ...(input.metadata ?? {}) },
    createdAt: now,
  }).onConflictDoNothing({ target: schema.auditLogs.id });
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

export async function getPostSaleWorkspaceAction(rawPeriodDays: unknown = 30, rawRuleFilter: unknown = "all"): Promise<ActionResult<{
  brokers: Array<{ id: string; name: string }>;
  queues: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; ruleKey: string | null; status: string; totals: Record<string, number>; createdAt: string; counts: PostSaleCampaignCounts }>;
  responses: Array<{ id: string; leadId: string; leadName: string; brokerName: string | null; campaignName: string; ruleKey: string | null; status: string; outcome: string | null; rating: number | null; answers: Record<string, unknown>; sentAt: string | null; lastReplyAt: string | null }>;
  report: PostSaleBrokerReportRow[];
  alerts: Awaited<ReturnType<typeof loadPostSaleOpenAlerts>>;
  periodDays: number;
  r0: R0Settings & { canEdit: boolean };
  ruleFilter: PostSaleRuleFilter;
  autoRules: { ready: boolean; canEdit: boolean; rules: AutoRuleSettings[] };
}>> {
  try {
    const context = await authorizedContext();
    const periodDays = postSalePeriodSchema.parse(rawPeriodDays);
    const ruleFilter = parsePostSaleRuleFilter(rawRuleFilter);
    const window = postSaleWindow(periodDays);
    const db = getDatabase();
    const branchFilter = context.role === "manager" ? context.branchId : undefined;
    const r0Settings = parseR0Settings(await getSystemSetting(postSaleR0SettingKey(context.tenantId)).catch(() => null));
    const [brokers, queues, campaigns, responses, report, alerts, branches, autoRules] = await Promise.all([
      db.select({ id: schema.tenantMemberships.userId, name: schema.user.name }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), branchFilter ? eq(schema.tenantMemberships.branchId, branchFilter) : undefined))
        .orderBy(schema.user.name),
      db.select({ id: schema.leadQueues.id, name: schema.leadQueues.name }).from(schema.leadQueues).where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.status, "active"), isNull(schema.leadQueues.deletedAt), branchFilter ? or(eq(schema.leadQueues.branchId, branchFilter), isNull(schema.leadQueues.branchId)) : undefined)).orderBy(schema.leadQueues.name),
      db.select({ id: schema.postSaleCampaigns.id, name: schema.postSaleCampaigns.name, ruleKey: schema.postSaleCampaigns.ruleKey, status: schema.postSaleCampaigns.status, totals: schema.postSaleCampaigns.totals, createdAt: schema.postSaleCampaigns.createdAt }).from(schema.postSaleCampaigns)
        .where(and(eq(schema.postSaleCampaigns.tenantId, context.tenantId), context.role === "manager" ? eq(schema.postSaleCampaigns.createdBy, context.userId) : undefined))
        .orderBy(desc(schema.postSaleCampaigns.createdAt)).limit(20),
      // Only clients who answered (09/11, Vinicios: "ir para os leads que responderam de forma fácil").
      db.select({ id: schema.postSaleSurveys.id, leadId: schema.postSaleSurveys.leadId, leadName: schema.leads.nome, brokerName: schema.user.name, campaignName: schema.postSaleCampaigns.name, ruleKey: schema.postSaleSurveys.ruleKey, status: schema.postSaleSurveys.status, outcome: schema.postSaleSurveys.outcome, rating: schema.postSaleSurveys.rating, answers: schema.postSaleSurveys.answers, sentAt: schema.postSaleSurveys.sentAt, lastReplyAt: schema.postSaleSurveys.lastReplyAt, createdAt: schema.postSaleSurveys.createdAt })
        .from(schema.postSaleSurveys)
        .leftJoin(schema.user, eq(schema.user.id, schema.postSaleSurveys.brokerId))
        .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
        .innerJoin(schema.postSaleCampaigns, and(eq(schema.postSaleCampaigns.id, schema.postSaleSurveys.campaignId), eq(schema.postSaleCampaigns.tenantId, schema.postSaleSurveys.tenantId)))
        .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
        .where(and(eq(schema.postSaleSurveys.tenantId, context.tenantId), isNotNull(schema.postSaleSurveys.lastReplyAt), isNull(schema.leads.deletedAt), branchFilter ? sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${branchFilter}` : undefined))
        .orderBy(desc(schema.postSaleSurveys.lastReplyAt), desc(schema.postSaleSurveys.createdAt)).limit(300),
      loadPostSaleBrokerReport(context, window, ruleFilter),
      loadPostSaleOpenAlerts(context),
      db.select({ id: schema.branches.id, name: schema.branches.name }).from(schema.branches)
        .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"), branchFilter ? eq(schema.branches.id, branchFilter) : undefined))
        .orderBy(schema.branches.name),
      loadAutoRules(context.tenantId),
    ]);
    const campaignCounts = await loadPostSaleCampaignCounts(context.tenantId, campaigns.map((row) => row.id));
    await recordPostSaleViewAudit({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_report", entityId: "workspace", action: "post_sale_report.viewed", metadata: { periodDays, brokerRows: report.length, openAlerts: alerts.length } });
    return { ok: true, data: {
      brokers: brokers.map((row) => ({ id: row.id, name: row.name ?? "Corretor" })),
      queues,
      campaigns: campaigns.map((row) => ({ ...row, totals: row.totals as Record<string, number>, createdAt: row.createdAt.toISOString(), counts: campaignCounts[row.id] ?? emptyPostSaleCampaignCounts() })),
      responses: responses.map((row) => ({ ...row, brokerName: row.brokerName ?? null, answers: row.answers as Record<string, unknown>, sentAt: row.sentAt?.toISOString() ?? null, lastReplyAt: row.lastReplyAt?.toISOString() ?? null })),
      report,
      alerts,
      periodDays,
      r0: { ...r0Settings, canEdit: context.role === "director" },
      ruleFilter,
      branches,
      autoRules: { ready: autoRules.ready, canEdit: context.role === "director" && autoRules.ready, rules: autoRules.rules },
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
    await recordPostSaleViewAudit({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_report", entityId: brokerId, action: "post_sale_report.broker_viewed", metadata: { periodDays, available: Boolean(report) } });
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
    await recordPostSaleViewAudit({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_survey", entityId: survey.id, action: "post_sale_survey.viewed", metadata: { leadId } });
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

/** The WhatsApp messages of one survey's conversation (from 1 min before the send), for the answers list. */
export async function getPostSaleSurveyMessagesAction(rawSurveyId: unknown): Promise<ActionResult<Array<{ id: string; direction: "in" | "out"; body: string; sentAt: string; fromAssistant: boolean }>>> {
  try {
    const context = await authorizedContext();
    const surveyId = z.string().trim().min(1).max(80).parse(rawSurveyId);
    const db = getDatabase();
    const branchFilter = context.role === "manager" ? context.branchId : undefined;
    const [survey] = await db.select({ leadId: schema.postSaleSurveys.leadId, sentAt: schema.postSaleSurveys.sentAt, createdAt: schema.postSaleSurveys.createdAt })
      .from(schema.postSaleSurveys)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
      .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
      .where(and(
        eq(schema.postSaleSurveys.id, surveyId),
        eq(schema.postSaleSurveys.tenantId, context.tenantId),
        branchFilter ? sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${branchFilter}` : undefined,
      ))
      .limit(1);
    if (!survey) return { ok: false, error: "Pesquisa não encontrada." };
    const since = new Date((survey.sentAt ?? survey.createdAt).getTime() - 60_000);
    const rows = await db.select({ id: schema.whatsappMessages.id, direction: schema.whatsappMessages.direction, body: schema.whatsappMessages.body, mediaKind: schema.whatsappMessages.mediaKind, sentAt: schema.whatsappMessages.sentAt, senderRole: schema.whatsappMessages.senderRole })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, survey.leadId), gte(schema.whatsappMessages.sentAt, since)))
      .orderBy(desc(schema.whatsappMessages.sentAt))
      .limit(80);
    rows.reverse(); // newest 80, shown oldest first: a long chat never cuts the survey answer (Vigia)
    await recordPostSaleViewAudit({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_survey", entityId: surveyId, action: "post_sale_survey.messages_viewed", metadata: { leadId: survey.leadId, messages: rows.length } });
    return { ok: true, data: rows
      .map((row) => ({
        id: row.id,
        direction: row.direction === "incoming" || row.direction === "inbound" ? "in" as const : "out" as const,
        body: row.body && row.body.trim() !== "[text]" ? row.body : row.mediaKind ? `[${row.mediaKind}]` : "",
        sentAt: row.sentAt.toISOString(),
        fromAssistant: row.senderRole === "assistant" || row.senderRole === "system",
      }))
      .filter((row) => row.body) };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

const r0SettingsInput = z.object({
  enabled: z.boolean(),
  queueIds: z.array(z.string().trim().min(1).max(80)).max(100),
});

/**
 * Liga ou desliga a R0 (cliente que volta a escrever) e escolhe as filas do piloto. Só diretor.
 * Fica em system_settings (`post_sale_r0_<tenantId>`), desligada por padrão.
 */
export async function savePostSaleR0SettingsAction(raw: unknown): Promise<ActionResult<R0Settings>> {
  try {
    const context = await authorizedContext();
    if (context.role !== "director") throw new PostSaleActionError("Apenas diretores podem ligar a regra do cliente que volta a escrever.");
    const input = r0SettingsInput.parse(raw);
    const queueIds = [...new Set(input.queueIds)];
    if (input.enabled && !queueIds.length) throw new PostSaleActionError("Escolha pelo menos uma fila para o piloto.");
    if (queueIds.length) {
      const found = await getDatabase().select({ id: schema.leadQueues.id }).from(schema.leadQueues)
        .where(and(eq(schema.leadQueues.tenantId, context.tenantId), inArray(schema.leadQueues.id, queueIds), isNull(schema.leadQueues.deletedAt)));
      if (found.length !== queueIds.length) throw new PostSaleActionError("Uma das filas escolhidas não existe mais. Atualize a página.");
    }
    const settings: R0Settings = { enabled: input.enabled, queueIds };
    await setSystemSetting(postSaleR0SettingKey(context.tenantId), serializeR0Settings(settings));
    await recordPostSaleAuditEvent({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_rule", entityId: "R0", action: "post_sale.r0.settings_updated", metadata: { enabled: settings.enabled, queueCount: queueIds.length } });
    return { ok: true, data: settings };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

/**
 * "Retomar agora" (09/11): sends the reminder of one unanswered survey right away (opening again, or the
 * last question as free text). One per step: a second click on the same step returns the same message.
 */
export async function resumePostSaleSurveyAction(rawSurveyId: unknown): Promise<ActionResult<{ duplicate: boolean }>> {
  try {
    const context = await authorizedContext();
    const surveyId = z.string().trim().min(1).max(80).parse(rawSurveyId);
    const db = getDatabase();
    const branchFilter = context.role === "manager" ? context.branchId : undefined;
    const [row] = await db.select({ survey: schema.postSaleSurveys })
      .from(schema.postSaleSurveys)
      .innerJoin(schema.leads, and(eq(schema.leads.id, schema.postSaleSurveys.leadId), eq(schema.leads.tenantId, schema.postSaleSurveys.tenantId)))
      .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
      .where(and(
        eq(schema.postSaleSurveys.id, surveyId),
        eq(schema.postSaleSurveys.tenantId, context.tenantId),
        branchFilter ? sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${branchFilter}` : undefined,
      )).limit(1);
    const survey = row?.survey;
    if (!survey) throw new PostSaleActionError("Pesquisa não encontrada.");
    if (!["sent", "answering"].includes(survey.status)) throw new PostSaleActionError("Esta pesquisa já foi encerrada.");
    if (survey.ruleKey === "R0") throw new PostSaleActionError("A conversa \"Cliente voltou a escrever\" não tem retomada manual.");
    if (!canResumePostSaleNow({ lastReplyAt: survey.lastReplyAt, channelType: survey.channelType, now: new Date() })) {
      throw new PostSaleActionError("A janela de 24 h do número oficial fechou. Só dá para retomar quando o cliente escrever de novo.");
    }
    const reference = survey.lastReplyAt ?? survey.sentAt ?? survey.createdAt;
    // Same key as the automatic reminder of this step: the button and the job never send two (Vigia).
    if (survey.reminderSentAt && survey.reminderSentAt >= reference) return { ok: true, data: { duplicate: true } };
    const outbound = await sendPostSaleNudge(survey, survey.lastReplyAt ? "question" : "opening", String(reference.getTime()));
    if (["failed", "cancelled", "expired", "skipped"].includes(outbound.status)) throw new PostSaleActionError("Não foi possível enviar pelo número de origem.");
    await recordPostSaleAuditEvent({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_survey", entityId: survey.id, action: "post_sale_survey.resumed", metadata: { leadId: survey.leadId, duplicate: Boolean(outbound.duplicate) } });
    return { ok: true, data: { duplicate: Boolean(outbound.duplicate) } };
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


/** Confere que filas, unidades e corretores escolhidos existem nesta empresa. */
async function assertAutoRuleReferences(tenantId: string, input: { filters: { queueIds: string[]; branchIds: string[] }; pilot: { queueIds: string[]; brokerIds: string[] } }) {
  const db = getDatabase();
  const queueIds = [...new Set([...input.filters.queueIds, ...input.pilot.queueIds])];
  const branchIds = [...new Set(input.filters.branchIds)];
  const brokerIds = [...new Set(input.pilot.brokerIds)];
  const [queues, branches, brokers] = await Promise.all([
    queueIds.length ? db.select({ id: schema.leadQueues.id }).from(schema.leadQueues).where(and(eq(schema.leadQueues.tenantId, tenantId), inArray(schema.leadQueues.id, queueIds), isNull(schema.leadQueues.deletedAt))) : [],
    branchIds.length ? db.select({ id: schema.branches.id }).from(schema.branches).where(and(eq(schema.branches.tenantId, tenantId), inArray(schema.branches.id, branchIds))) : [],
    brokerIds.length ? db.select({ id: schema.tenantMemberships.userId }).from(schema.tenantMemberships).where(and(eq(schema.tenantMemberships.tenantId, tenantId), inArray(schema.tenantMemberships.userId, brokerIds))) : [],
  ]);
  if (queues.length !== queueIds.length) throw new PostSaleActionError("Uma das filas escolhidas não existe mais. Atualize a página.");
  if (branches.length !== branchIds.length) throw new PostSaleActionError("Uma das unidades escolhidas não existe mais. Atualize a página.");
  if (new Set(brokers.map((row) => row.id)).size !== brokerIds.length) throw new PostSaleActionError("Um dos corretores escolhidos não está mais na empresa. Atualize a página.");
}

/**
 * Régua automática (R1 a R5): liga ou desliga uma regra e ajusta atraso, filtros, limite e piloto.
 * Só diretor. Fica em `post_sale_rules`; sem a tabela, avisa que o SQL ainda não rodou.
 */
export async function savePostSaleAutoRuleAction(raw: unknown): Promise<ActionResult<AutoRuleSettings>> {
  try {
    const context = await authorizedContext();
    if (context.role !== "director") throw new PostSaleActionError("Apenas diretores podem alterar a régua automática.");
    const input = autoRuleSettingsInputSchema.parse(raw);
    await assertAutoRuleReferences(context.tenantId, input);
    const saved = await saveAutoRule(context.tenantId, input, context.userId);
    await recordPostSaleAuditEvent({ tenantId: context.tenantId, userId: context.userId, entity: "post_sale_rule", entityId: input.key, action: "post_sale.auto_rule.updated", metadata: {
      enabled: saved.enabled,
      delayBusinessDays: saved.delayBusinessDays,
      dailyLimit: saved.dailyLimit,
      filters: { queues: saved.filters.queueIds.length, branches: saved.filters.branchIds.length, leadTypes: saved.filters.leadTypes },
      pilot: { queues: saved.pilot.queueIds.length, brokers: saved.pilot.brokerIds.length },
    } });
    return { ok: true, data: saved };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

/** Prévia "amanhã sairiam N mensagens" com as configurações em edição. Só diretor; não grava nada. */
export async function previewPostSaleAutoRuleAction(raw: unknown): Promise<ActionResult<AutoRulePreview>> {
  try {
    const context = await authorizedContext();
    if (context.role !== "director") throw new PostSaleActionError("Apenas diretores podem ver a prévia da régua automática.");
    const input = autoRuleSettingsInputSchema.parse(raw);
    const preview = await previewAutoRule(context, { ...input, updatedAt: null });
    return { ok: true, data: preview };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}

/**
 * "Reenviar as que falharam" (09/11): pesquisas de uma campanha manual que falharam no envio (outbox
 * failed/cancelled/expired, inclusive a abertura aceita e depois recusada pela Meta, ex. 131042) ou foram
 * puladas por canal/template. Reavalia o público só desses leads com as regras atuais e devolve a mesma
 * linha para a fila com uma chave nova no outbox. Diretor; gestor só na campanha da unidade dele.
 */
export async function retryFailedPostSaleCampaignAction(campaignId: string): Promise<ActionResult<PostSaleRetryResult>> {
  try {
    const context = await authorizedContext();
    const validId = z.string().trim().min(1).max(80).parse(campaignId);
    const [campaign] = await getDatabase().select().from(schema.postSaleCampaigns).where(and(
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
    if (campaign.kind !== "manual" || campaign.ruleKey) throw new PostSaleActionError("Só campanhas manuais podem ser reenviadas por aqui.");
    if (campaign.status === "draft") throw new PostSaleActionError("Esta campanha ainda não foi iniciada.");
    const result = await retryFailedPostSaleSurveys(context, campaign);
    if (!result.retryable) throw new PostSaleActionError("Nenhuma pesquisa desta campanha está para reenviar.");
    const { retryable, ...data } = result;
    await recordPostSaleAudit({ tenantId: context.tenantId, userId: context.userId, campaignId: campaign.id, action: "post_sale_campaign.retried", metadata: { retryable, ...data } });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: safeFailure(error) };
  }
}
