import "server-only";

import { and, eq, inArray, isNull, like, ne, sql } from "drizzle-orm";
import { enqueueMetaTemplateMessage, enqueuePostSaleSurveyWahaMessage } from "@/features/communication-channels/outbound-service";
import { isBusinessHours, nextBusinessOpening } from "@/features/team-notices/guard";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { resolvePostSaleAudience } from "./audience";
import {
  keepSurveysInUnit,
  classifyPostSaleRetry,
  emptyPostSaleCampaignCounts,
  nextPostSaleRetryAttempt,
  postSaleRetryIdempotencyKey,
  postSaleRetryKeyPrefix,
  summarizePostSaleCampaignSurveys,
  type PostSaleCampaignCounts,
  type PostSaleRetryKind,
  type PostSaleRetryResult,
} from "./campaign-retry";
import { firstName, POST_SALE_EXCLUSION_LABELS, renderPostSaleOpeningMessage, type PostSaleExclusionReason } from "./rules";
import { POST_SALE_META_TEMPLATE, POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";

const UNAVAILABLE_LABEL = "lead indisponível ou fora da unidade";
const DIRECTOR_OWNER_LABEL = "lead de um diretor";
const ALREADY_RETRYING_LABEL = "já estava sendo reenviada";

/** The lead is already in a newer survey (another campaign): the retry belongs to that one. */
const supersededSql = sql<boolean>`exists (select 1 from post_sale_surveys newer_survey where newer_survey.tenant_id = ${schema.postSaleSurveys.tenantId} and newer_survey.lead_id = ${schema.postSaleSurveys.leadId} and newer_survey.id <> ${schema.postSaleSurveys.id} and newer_survey.created_at > ${schema.postSaleSurveys.createdAt})`;

/** Contadores (enviadas, falharam, puladas, reenviáveis) das campanhas listadas no card. */
export async function loadPostSaleCampaignCounts(tenantId: string, campaignIds: string[]): Promise<Record<string, PostSaleCampaignCounts>> {
  if (!campaignIds.length) return {};
  const rows = await getDatabase().select({
    campaignId: schema.postSaleSurveys.campaignId,
    status: schema.postSaleSurveys.status,
    skipReason: schema.postSaleSurveys.skipReason,
    step: schema.postSaleSurveys.step,
    hasReply: sql<boolean>`${schema.postSaleSurveys.lastReplyAt} is not null`,
    completed: sql<boolean>`${schema.postSaleSurveys.completedAt} is not null`,
    outboundStatus: schema.whatsappOutboundMessages.status,
    superseded: supersededSql,
    count: sql<number>`count(*)::int`,
  }).from(schema.postSaleSurveys)
    .leftJoin(schema.whatsappOutboundMessages, and(
      eq(schema.whatsappOutboundMessages.id, schema.postSaleSurveys.outboundId),
      eq(schema.whatsappOutboundMessages.tenantId, schema.postSaleSurveys.tenantId),
    ))
    .where(and(eq(schema.postSaleSurveys.tenantId, tenantId), inArray(schema.postSaleSurveys.campaignId, campaignIds)))
    .groupBy(
      schema.postSaleSurveys.campaignId, schema.postSaleSurveys.status, schema.postSaleSurveys.skipReason, schema.postSaleSurveys.step,
      sql`${schema.postSaleSurveys.lastReplyAt} is not null`, sql`${schema.postSaleSurveys.completedAt} is not null`, schema.whatsappOutboundMessages.status, supersededSql,
    );
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) grouped.set(row.campaignId, [...(grouped.get(row.campaignId) ?? []), row]);
  return Object.fromEntries(campaignIds.map((id) => [id, grouped.has(id) ? summarizePostSaleCampaignSurveys(grouped.get(id)!) : emptyPostSaleCampaignCounts()]));
}

type RetrySurvey = {
  id: string;
  leadId: string;
  brokerId: string | null;
  status: string;
  outboundId: string | null;
  kind: PostSaleRetryKind;
};

function scheduledOpening(now: Date) {
  return isBusinessHours(now) ? undefined : nextBusinessOpening(now);
}

/** The survey still points to the outbox row we read (null stays null). */
function sameOutbound(outboundId: string | null) {
  return outboundId ? eq(schema.postSaleSurveys.outboundId, outboundId) : isNull(schema.postSaleSurveys.outboundId);
}

function bump(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1;
}

/**
 * Reenvia as pesquisas que falharam (ou foram puladas por canal/template) de uma campanha manual.
 * Público reavaliado só para esses leads com as regras atuais (opt-out, 60 dias, humano em 24 h,
 * número errado, canal e template); a mesma linha da pesquisa volta para a fila com uma chave nova
 * no outbox. A troca de estado é condicional (status e outbound antigos), então dois cliques não
 * enfileiram duas vezes. A autorização e o escopo do gestor ficam na action.
 */
export async function retryFailedPostSaleSurveys(context: TenantContext, campaign: { id: string; openingMessage: string }, now = new Date()): Promise<PostSaleRetryResult & { retryable: number }> {
  const db = getDatabase();
  const rows = await db.select({
    id: schema.postSaleSurveys.id,
    leadId: schema.postSaleSurveys.leadId,
    brokerId: schema.postSaleSurveys.brokerId,
    status: schema.postSaleSurveys.status,
    skipReason: schema.postSaleSurveys.skipReason,
    step: schema.postSaleSurveys.step,
    outboundId: schema.postSaleSurveys.outboundId,
    lastReplyAt: schema.postSaleSurveys.lastReplyAt,
    completedAt: schema.postSaleSurveys.completedAt,
    outboundStatus: schema.whatsappOutboundMessages.status,
    superseded: supersededSql,
  }).from(schema.postSaleSurveys)
    .leftJoin(schema.whatsappOutboundMessages, and(
      eq(schema.whatsappOutboundMessages.id, schema.postSaleSurveys.outboundId),
      eq(schema.whatsappOutboundMessages.tenantId, schema.postSaleSurveys.tenantId),
    ))
    .where(and(eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.campaignId, campaign.id)));

  const retryable: RetrySurvey[] = [];
  for (const row of rows) {
    const kind = classifyPostSaleRetry({
      status: row.status, skipReason: row.skipReason, outboundStatus: row.outboundStatus ?? null, step: row.step,
      hasReply: Boolean(row.lastReplyAt), completed: Boolean(row.completedAt), superseded: Boolean(row.superseded),
    });
    if (kind) retryable.push({ id: row.id, leadId: row.leadId, brokerId: row.brokerId, status: row.status, outboundId: row.outboundId, kind });
  }
  // A manager only touches surveys of leads in his unit (lead unit, or the queue's): reading, re-queueing
  // and marking failed never reach another unit (Vigia, 09/11).
  if (context.role === "manager") {
    const leadIds = [...new Set(retryable.map((survey) => survey.leadId))];
    const inUnit = leadIds.length ? await db.select({ id: schema.leads.id }).from(schema.leads)
      .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.leads.queueId), eq(schema.leadQueues.tenantId, schema.leads.tenantId)))
      .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, leadIds), sql`coalesce(${schema.leads.branchId}, ${schema.leadQueues.branchId}) = ${context.branchId}`)) : [];
    const kept = keepSurveysInUnit(retryable, new Set(inUnit.map((row) => row.id)));
    retryable.splice(0, retryable.length, ...kept);
  }
  const result: PostSaleRetryResult & { retryable: number } = { requeued: 0, failed: 0, stillSkipped: {}, retryable: retryable.length };
  if (!retryable.length) return result;

  // Current rules for these leads only (manager scope is applied inside: other units are not selected).
  const preview = await resolvePostSaleAudience(context, { kind: "leadIds", leadIds: retryable.map((survey) => survey.leadId) }, now);
  for (const [reason, count] of Object.entries(preview.excluded)) {
    if (count > 0) result.stillSkipped[POST_SALE_EXCLUSION_LABELS[reason as PostSaleExclusionReason] ?? reason] = count;
  }
  const missing = retryable.length - preview.totalSelected;
  if (missing > 0) result.stillSkipped[UNAVAILABLE_LABEL] = missing;

  const recipients = new Map(preview.recipients.map((recipient) => [recipient.leadId, recipient]));
  const skippedNow = new Map(preview.skippedRecipients.map((recipient) => [recipient.leadId, recipient]));

  // A survey that "went out" but bounced (Meta 131042) and still cannot go: mark it failed, so the reminder
  // job does not nudge a client who never got the opening. Only the exact row we read (same outbound).
  const settleUnsent = async (survey: RetrySurvey, reason: string) => {
    if (survey.status !== "sent") return;
    await db.update(schema.postSaleSurveys).set({ status: "failed", skipReason: reason.slice(0, 240) }).where(and(
      eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.status, "sent"),
      sameOutbound(survey.outboundId), isNull(schema.postSaleSurveys.lastReplyAt),
    ));
  };
  for (const survey of retryable) {
    if (recipients.has(survey.leadId)) continue;
    const skipped = skippedNow.get(survey.leadId);
    if (skipped && survey.status === "skipped") {
      await db.update(schema.postSaleSurveys).set({ skipReason: POST_SALE_EXCLUSION_LABELS[skipped.reason], channelType: skipped.channelType, channelRef: skipped.channelRef }).where(and(
        eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.status, "skipped"),
      ));
    }
    await settleUnsent(survey, "a abertura não foi entregue e o reenvio não está liberado");
  }

  const eligible = retryable.filter((survey) => recipients.has(survey.leadId));
  if (!eligible.length) return result;

  // Director-owned leads are left out, as in the automatic rule (the director is never audited).
  const peopleIds = [...new Set(eligible.flatMap((survey) => [survey.brokerId, recipients.get(survey.leadId)!.brokerId]).filter((id): id is string => Boolean(id)))];
  const people = peopleIds.length ? await db.select({ id: schema.user.id, name: schema.user.name, role: schema.tenantMemberships.role })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), inArray(schema.tenantMemberships.userId, peopleIds))) : [];
  const directors = new Set(people.filter((person) => person.role === "director").map((person) => person.id));
  const names = new Map(people.map((person) => [person.id, firstName(person.name)]));

  const [tenant] = await db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);
  const [config] = await db.select({ assistantName: schema.aiQualificationConfigs.assistantName }).from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, context.tenantId)).limit(1);
  const companyName = tenant?.name?.trim() || "nossa equipe";
  const assistantName = config?.assistantName?.trim() || "equipe de qualidade";
  const scheduledAt = scheduledOpening(now);

  for (const survey of eligible) {
    const recipient = recipients.get(survey.leadId)!;
    if (directors.has(recipient.brokerId) || (survey.brokerId && directors.has(survey.brokerId))) {
      bump(result.stillSkipped, DIRECTOR_OWNER_LABEL);
      await settleUnsent(survey, "a abertura não foi entregue; lead de um diretor");
      continue;
    }
    const revertStatus = survey.kind === "skipped_channel" ? "skipped" : "failed";
    // Claim: only the exact state we read moves to the queue. A second click (or a concurrent one) finds
    // the row already "queued" and changes nothing.
    const [claimed] = await db.update(schema.postSaleSurveys).set({
      status: "queued", skipReason: null, outboundId: null, sentAt: null, reminderSentAt: null,
      phone: recipient.phone, channelType: recipient.channelType, channelRef: recipient.channelRef,
    }).where(and(
      eq(schema.postSaleSurveys.id, survey.id),
      eq(schema.postSaleSurveys.tenantId, context.tenantId),
      eq(schema.postSaleSurveys.status, survey.status),
      sameOutbound(survey.outboundId),
      isNull(schema.postSaleSurveys.lastReplyAt),
    )).returning({ id: schema.postSaleSurveys.id });
    if (!claimed) { bump(result.stillSkipped, ALREADY_RETRYING_LABEL); continue; }

    const release = async (status: "failed" | "skipped", reason: string, outboundId: string | null = survey.outboundId) => {
      await db.update(schema.postSaleSurveys).set({ status, skipReason: reason, outboundId }).where(and(
        eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, context.tenantId), eq(schema.postSaleSurveys.status, "queued"),
      ));
    };

    // Another campaign may have queued this lead after the audience was read (two retries at once).
    const [other] = await db.select({ id: schema.postSaleSurveys.id }).from(schema.postSaleSurveys).where(and(
      eq(schema.postSaleSurveys.tenantId, context.tenantId),
      eq(schema.postSaleSurveys.leadId, survey.leadId),
      ne(schema.postSaleSurveys.id, survey.id),
      eq(schema.postSaleSurveys.status, "queued"),
    )).limit(1);
    if (other) {
      await release(revertStatus, POST_SALE_EXCLUSION_LABELS.recent_survey);
      bump(result.stillSkipped, POST_SALE_EXCLUSION_LABELS.recent_survey);
      continue;
    }

    try {
      const previousKeys = await db.select({ key: schema.whatsappOutboundMessages.idempotencyKey }).from(schema.whatsappOutboundMessages).where(and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        like(schema.whatsappOutboundMessages.idempotencyKey, `${postSaleRetryKeyPrefix(campaign.id, survey.leadId)}%`),
      ));
      const idempotencyKey = postSaleRetryIdempotencyKey(campaign.id, survey.leadId, nextPostSaleRetryAttempt(previousKeys.map((row) => row.key), campaign.id, survey.leadId));
      const brokerName = names.get(survey.brokerId ?? recipient.brokerId) ?? "nosso corretor";
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
      if (["failed", "cancelled", "expired"].includes(outbound.status)) {
        await release("failed", "falha ao enfileirar o canal de origem", outbound.id);
        result.failed += 1;
      } else if (outbound.status === "skipped") {
        await release("skipped", "número de origem indisponível", outbound.id);
        bump(result.stillSkipped, POST_SALE_EXCLUSION_LABELS.source_unavailable);
      } else {
        // The outbox may already have synced the row (sent); only link it while still queued.
        await db.update(schema.postSaleSurveys).set({ outboundId: outbound.id }).where(and(
          eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, context.tenantId), isNull(schema.postSaleSurveys.outboundId),
        ));
        result.requeued += 1;
      }
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
      if (code === "FIRST_CONTACT_TEMPLATE_UNAVAILABLE") {
        await release("skipped", POST_SALE_EXCLUSION_LABELS.template_unapproved);
        bump(result.stillSkipped, POST_SALE_EXCLUSION_LABELS.template_unapproved);
      } else if (code === "POST_SALE_SOURCE_UNAVAILABLE" || code === "META_CHANNEL_UNAVAILABLE") {
        await release("skipped", POST_SALE_EXCLUSION_LABELS.source_unavailable);
        bump(result.stillSkipped, POST_SALE_EXCLUSION_LABELS.source_unavailable);
      } else {
        console.warn("[post-sale-retry] enqueue_failed", { tenantId: context.tenantId, surveyId: survey.id, error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
        await release("failed", "falha ao enfileirar o canal de origem");
        result.failed += 1;
      }
    }
  }
  return result;
}

