"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { hasEffectiveCapability } from "@/features/custom-roles/service";
import { enqueueMetaTemplateMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { isBusinessHours, nextBusinessOpening } from "@/features/team-notices/guard";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
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
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: input.userId,
    entidade: "post_sale_campaign",
    entidadeId: input.campaignId,
    acao: input.action,
    metadata: { source: "post_sale_audit", tenantId: input.tenantId, ...(input.metadata ?? {}) },
  });
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
    const audience = postSaleAudienceSchema.parse(parsed.audience);
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

