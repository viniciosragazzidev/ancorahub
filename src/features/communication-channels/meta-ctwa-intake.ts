import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { createLeadFromWebhookSync } from "@/features/leads/webhooks/services/create-lead-from-webhook-sync";
import { resolveMetaCapturePolicy, type MetaCaptureMode } from "@/features/meta-ads/meta-capture-policy";
import { decryptMetaToken } from "@/features/meta-ads/meta-oauth";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import type { ChannelLeadIntake } from "./channel-lead-intake";
import { getMetaLeadAdsWebhookConfig } from "./meta-cloud-config";
import { META_CTWA_ENTRY, ctwaLeadName, type readCtwaAdReferral } from "./meta-ctwa-referral";

type AdHierarchy = { campaignId: string | null; adSetId: string | null; campaignName: string | null };

/** The synced ad tree first; Meta's Graph only when the ad was not synced yet. */
async function resolveAdHierarchy(tenantId: string, adId: string): Promise<AdHierarchy> {
  const db = getDatabase();
  const [synced] = await db.select({ adSetId: schema.metaAds.adSetId, campaignId: schema.metaAdSets.campaignId, campaignName: schema.metaCampaigns.name })
    .from(schema.metaAds)
    .leftJoin(schema.metaAdSets, and(eq(schema.metaAdSets.tenantId, schema.metaAds.tenantId), eq(schema.metaAdSets.adSetId, schema.metaAds.adSetId)))
    .leftJoin(schema.metaCampaigns, and(eq(schema.metaCampaigns.tenantId, schema.metaAds.tenantId), eq(schema.metaCampaigns.campaignId, schema.metaAdSets.campaignId)))
    .where(and(eq(schema.metaAds.tenantId, tenantId), eq(schema.metaAds.adId, adId)))
    .limit(1);
  if (synced?.campaignId) return { campaignId: synced.campaignId, adSetId: synced.adSetId, campaignName: synced.campaignName ?? null };

  const [connection] = await db.select({ accessTokenCiphertext: schema.metaConnections.accessTokenCiphertext })
    .from(schema.metaConnections)
    .where(and(eq(schema.metaConnections.tenantId, tenantId), eq(schema.metaConnections.status, "connected")))
    .orderBy(desc(schema.metaConnections.updatedAt))
    .limit(1);
  if (!connection) return { campaignId: null, adSetId: synced?.adSetId ?? null, campaignName: null };
  try {
    const { graphVersion } = getMetaLeadAdsWebhookConfig();
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(adId)}?fields=campaign_id,adset_id,campaign{name}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${decryptMetaToken(connection.accessTokenCiphertext)}` }, cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { campaign_id?: string; adset_id?: string; campaign?: { name?: string } };
    if (!response.ok) return { campaignId: null, adSetId: synced?.adSetId ?? null, campaignName: null };
    return { campaignId: payload.campaign_id ?? null, adSetId: payload.adset_id ?? synced?.adSetId ?? null, campaignName: payload.campaign?.name ?? null };
  } catch {
    return { campaignId: null, adSetId: synced?.adSetId ?? null, campaignName: null };
  }
}

async function resolveCapture(tenantId: string, campaignId: string | null, adId: string) {
  const db = getDatabase();
  const [campaignRoute] = campaignId ? await db.select({ queueId: schema.metaCampaignQueueRoutes.queueId, enabled: schema.metaCampaignQueueRoutes.enabled, queueStatus: schema.leadQueues.status })
    .from(schema.metaCampaignQueueRoutes)
    .leftJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
    .where(and(eq(schema.metaCampaignQueueRoutes.tenantId, tenantId), eq(schema.metaCampaignQueueRoutes.campaignId, campaignId)))
    .limit(1) : [];
  const [adRoute] = await db.select({ queueId: schema.metaAdQueueRoutes.queueId, enabled: schema.metaAdQueueRoutes.enabled, queueStatus: schema.leadQueues.status })
    .from(schema.metaAdQueueRoutes)
    .leftJoin(schema.leadQueues, eq(schema.metaAdQueueRoutes.queueId, schema.leadQueues.id))
    .where(and(eq(schema.metaAdQueueRoutes.tenantId, tenantId), eq(schema.metaAdQueueRoutes.adId, adId)))
    .limit(1);

  const stored = await getSystemSetting(`meta_lead_capture_mode_${tenantId}`).catch(() => null);
  let globalMode: MetaCaptureMode;
  if (stored === "all" || stored === "selective" || stored === "disabled") {
    globalMode = stored;
  } else {
    const [anyCampaign] = await db.select({ id: schema.metaCampaignQueueRoutes.id }).from(schema.metaCampaignQueueRoutes).where(eq(schema.metaCampaignQueueRoutes.tenantId, tenantId)).limit(1);
    const [anyAd] = await db.select({ id: schema.metaAdQueueRoutes.id }).from(schema.metaAdQueueRoutes).where(eq(schema.metaAdQueueRoutes.tenantId, tenantId)).limit(1);
    const [anyForm] = await db.select({ id: schema.metaFormQueueRoutes.id }).from(schema.metaFormQueueRoutes).where(eq(schema.metaFormQueueRoutes.tenantId, tenantId)).limit(1);
    globalMode = anyCampaign || anyAd || anyForm ? "selective" : "all";
  }
  return { decision: resolveMetaCapturePolicy({ adRoute, campaignRoute, globalMode }), adRoute, campaignRoute };
}

export type CtwaIntakeResult =
  | { status: "created" | "existing"; leadId: string }
  | { status: "ignored"; reason: "no_source" | "policy" | "rejected" };

/**
 * Creates the lead for an unknown number's first message from an ad. The
 * message must already be stored: the qualification then answers what the
 * customer wrote instead of sending a cold opening template.
 */
/** The tenant's Meta Lead Ads source: it carries the intake credential and its owner. */
async function tenantIntakeSource(tenantId: string) {
  const db = getDatabase();
  const [source] = await db.select({ id: schema.metaLeadAdSources.id, branchId: schema.metaLeadAdSources.branchId, credentialId: schema.metaLeadAdSources.leadWebhookCredentialId, createdBy: schema.metaLeadAdSources.createdBy, pageId: schema.metaLeadAdSources.pageId })
    .from(schema.metaLeadAdSources)
    .where(and(eq(schema.metaLeadAdSources.tenantId, tenantId), eq(schema.metaLeadAdSources.status, "active")))
    .orderBy(desc(schema.metaLeadAdSources.lastLeadAt))
    .limit(1);
  const [credential] = source ? await db.select({ createdBy: schema.leadWebhookCredentials.createdBy }).from(schema.leadWebhookCredentials).where(eq(schema.leadWebhookCredentials.id, source.credentialId)).limit(1) : [];
  const actorUserId = source?.createdBy ?? credential?.createdBy;
  return source && actorUserId ? { ...source, actorUserId } : null;
}

export async function ingestCtwaLead(input: {
  tenantId: string;
  phone: string;
  profileName?: string;
  referral: NonNullable<ReturnType<typeof readCtwaAdReferral>>;
  providerMessageId: string;
  receivedAt: Date;
  /** The number's own intake: used when the ad's campaign has no rule (or is not synced yet). */
  channelIntake?: ChannelLeadIntake | null;
  /** The lead is only received: the AI never talks to it. */
  skipAiQualification?: boolean;
}): Promise<CtwaIntakeResult> {
  const db = getDatabase();
  const source = await tenantIntakeSource(input.tenantId);
  if (!source) return { status: "ignored", reason: "no_source" };
  const actorUserId = source.actorUserId;

  const hierarchy = await resolveAdHierarchy(input.tenantId, input.referral.adId);
  const capture = await resolveCapture(input.tenantId, hierarchy.campaignId, input.referral.adId);
  const { adRoute } = capture;
  let decision = capture.decision;
  // No rule at all for this ad or its campaign (a "não registrar" rule is
  // kept): a number dedicated to ads takes the lead into its own queue.
  if (decision.action === "ignore" && !capture.adRoute && !capture.campaignRoute && input.channelIntake?.enabled) {
    decision = { action: "capture", queueId: input.channelIntake.queueId };
  }
  if (decision.action === "ignore") {
    await db.insert(schema.auditLogs).values({
      id: randomUUID(), userId: actorUserId, entidade: adRoute ? "meta_ad_queue_route" : "meta_campaign_queue_route",
      entidadeId: adRoute ? input.referral.adId : hierarchy.campaignId ?? input.referral.adId, acao: "meta_ctwa.ignored", createdAt: input.receivedAt,
    });
    return { status: "ignored", reason: "policy" };
  }

  const result = await createLeadFromWebhookSync({
    tenantId: input.tenantId, branchId: source.branchId ?? null, queueId: decision.queueId, credentialId: source.credentialId, createdByUserId: actorUserId,
    payload: { nome: ctwaLeadName(input.profileName, input.phone), telefone: input.phone, email: "", website: "" },
    idempotencyKey: `meta-ctwa-${input.providerMessageId}`,
    skipAiQualification: input.skipAiQualification,
    requestMetadata: { requestId: `meta-ctwa-${input.providerMessageId}`, userAgent: "meta-cloud-webhook", receivedAt: input.receivedAt },
    leadSource: {
      channel: "meta_lead_ads",
      externalId: `ctwa:${input.providerMessageId}`,
      campaign: hierarchy.campaignId,
      ad: input.referral.adId,
      adSet: hierarchy.adSetId,
      form: null,
      page: null,
      capturedAt: input.receivedAt,
      metadata: {
        entry: META_CTWA_ENTRY,
        adsLabel: input.channelIntake?.enabled ? input.channelIntake.label : null,
        campaignName: hierarchy.campaignName,
        adHeadline: input.referral.headline,
        adUrl: input.referral.sourceUrl,
        ctwaClid: input.referral.ctwaClid,
      },
    },
  });
  if (!result.success) {
    console.error("[meta-ctwa] lead.rejected", { tenantId: input.tenantId, code: result.code });
    return { status: "ignored", reason: "rejected" };
  }
  await db.update(schema.metaLeadAdSources).set({ lastLeadAt: input.receivedAt, updatedAt: new Date() }).where(eq(schema.metaLeadAdSources.id, source.id));
  return { status: result.duplicate ? "existing" : "created", leadId: result.leadId };
}

/**
 * A contact with no lead who writes to a number dedicated to ads without the
 * ad's referral (Meta only sends it on the first message after the click):
 * the lead is created with the number's origin and queue. A contact that had
 * talked to the number before it was connected (an old ad lead coming back)
 * is a lead too; team members never get here (their messages are handled
 * before the intake).
 */
export async function ingestChannelLead(input: {
  tenantId: string;
  channelId: string;
  phone: string;
  profileName?: string;
  providerMessageId: string;
  receivedAt: Date;
  intake: ChannelLeadIntake;
  /** The lead is only received: the AI never talks to it. */
  skipAiQualification?: boolean;
}): Promise<CtwaIntakeResult> {
  if (!input.intake.enabled) return { status: "ignored", reason: "policy" };
  const source = await tenantIntakeSource(input.tenantId);
  if (!source) return { status: "ignored", reason: "no_source" };
  const result = await createLeadFromWebhookSync({
    tenantId: input.tenantId, branchId: source.branchId ?? null, queueId: input.intake.queueId, credentialId: source.credentialId, createdByUserId: source.actorUserId,
    payload: { nome: ctwaLeadName(input.profileName, input.phone), telefone: input.phone, email: "", website: "" },
    idempotencyKey: `meta-wa-${input.providerMessageId}`,
    skipAiQualification: input.skipAiQualification,
    requestMetadata: { requestId: `meta-wa-${input.providerMessageId}`, userAgent: "meta-cloud-webhook", receivedAt: input.receivedAt },
    leadSource: {
      channel: "meta_lead_ads",
      externalId: `wa:${input.providerMessageId}`,
      campaign: null,
      ad: null,
      form: null,
      page: null,
      capturedAt: input.receivedAt,
      metadata: { entry: META_CTWA_ENTRY, adsLabel: input.intake.label, withoutReferral: true },
    },
  });
  if (!result.success) {
    console.error("[meta-channel-intake] lead.rejected", { tenantId: input.tenantId, code: result.code });
    return { status: "ignored", reason: "rejected" };
  }
  return { status: result.duplicate ? "existing" : "created", leadId: result.leadId };
}
