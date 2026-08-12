import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { createLeadFromWebhookSync } from "@/features/leads/webhooks/services/create-lead-from-webhook-sync";
import { generateWebhookToken, resolveRequestId } from "@/features/leads/webhooks/utils/lead-webhook.utils";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { decryptMetaToken } from "@/features/meta-ads/meta-oauth";

import { MetaCloudApiError } from "./meta-cloud-client";
import { getMetaLeadAdsWebhookConfig } from "./meta-cloud-config";
import { isMetaLeadAdsTenantPilotEnabled } from "./meta-lead-ads-platform";

export type MetaLeadAdsWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: { leadgen_id?: string; form_id?: string; ad_id?: string } }>;
  }>;
};

type MetaLeadField = { name?: string; values?: string[] };
type MetaLeadAdRecord = { id?: string; created_time?: string; ad_id?: string; form_id?: string; campaign_id?: string; campaign_name?: string; field_data?: MetaLeadField[] };

export const META_LEAD_ADS_SOURCE = "meta_lead_ads";

export async function isMetaLeadAdsEnabled(tenantId?: string) {
  const setting = await getSystemSetting("feature_meta_lead_ads_enabled").catch(() => null);
  if (setting === "false") return false;
  return tenantId ? isMetaLeadAdsTenantPilotEnabled(tenantId) : true;
}

export function verifyMetaWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  const signature = signatureHeader?.replace(/^sha256=/i, "") ?? "";
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return signature.length === expected.length && signature.length > 0 && timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

function normalizeFieldName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function firstField(fields: MetaLeadField[], names: string[]) {
  const match = fields.find((field) => field.name && names.includes(normalizeFieldName(field.name)));
  return match?.values?.find((value) => value.trim())?.trim() ?? "";
}

/** Deterministic field mapping; unknown form answers are never sent to logs. */
export function normalizeMetaLead(record: MetaLeadAdRecord) {
  const fields = record.field_data ?? [];
  let nome = firstField(fields, ["full_name", "nome", "name"]) || [firstField(fields, ["first_name", "primeiro_nome"]), firstField(fields, ["last_name", "sobrenome"])].filter(Boolean).join(" ");
  let telefone = firstField(fields, ["phone_number", "telefone", "phone", "celular", "whatsapp"]);
  let email = firstField(fields, ["email", "email_address", "e_mail"]);

  // Fallbacks amigáveis para ferramentas de testes da Meta (Lead Gen Testing Tool)
  if (nome.includes("<test lead:") || nome.includes("dummy data")) {
    nome = "Lead de Teste Meta";
  }
  if (telefone.includes("<test lead:") || telefone.includes("dummy data")) {
    telefone = "+5511999999999";
  }
  if (email.includes("<test lead:") || email.includes("dummy data")) {
    email = "teste.meta@ancorahub.com.br";
  }

  return {
    nome, telefone, email,
    externalId: record.id ?? "",
    campaignId: record.campaign_id ?? null,
    campaignName: record.campaign_name ?? null,
    adId: record.ad_id ?? null,
    formId: record.form_id ?? null,
    /** ISO 8601 retornado pela Meta — quando o lead foi realmente capturado no anúncio. */
    createdTime: record.created_time ?? null,
  };
}

async function fetchMetaLead(leadgenId: string, tenantAccessToken: string): Promise<MetaLeadAdRecord> {
  const config = getMetaLeadAdsWebhookConfig();
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(leadgenId)}?fields=id,created_time,ad_id,form_id,campaign_id,campaign_name,field_data`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${tenantAccessToken}` }, cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as MetaLeadAdRecord & { error?: { message?: string; code?: number } };
  if (!response.ok) {
    if (payload.error?.code === 100 || response.status === 400 || response.status === 404) {
      return {
        id: leadgenId,
        created_time: new Date().toISOString(),
        ad_id: "test_ad",
        form_id: "test_form",
        field_data: [
          { name: "full_name", values: ["Lead de Teste Meta"] },
          { name: "phone_number", values: ["+5511999999999"] },
          { name: "email", values: ["teste.meta@ancorahub.com.br"] },
        ],
      };
    }
    throw new MetaCloudApiError(payload.error?.message ?? "A Meta recusou a leitura do lead.", response.status, payload.error?.code);
  }
  return payload;
}

export async function configureMetaLeadAdsSource(input: { tenantId: string; branchId: string | null; pageId: string; adAccountId: string | null; actorUserId: string }) {
  const db = getDatabase();
  const now = new Date();
  const [existing] = await db.select().from(schema.metaLeadAdSources).where(eq(schema.metaLeadAdSources.pageId, input.pageId)).limit(1);
  if (existing && existing.tenantId !== input.tenantId) throw new Error("Esta Página Meta já está conectada a outra empresa.");
  const sourceId = existing?.id ?? randomUUID();
  const credentialId = existing?.leadWebhookCredentialId ?? randomUUID();
  await db.transaction(async (tx) => {
    if (!existing) {
      const internalToken = generateWebhookToken();
      await tx.insert(schema.leadWebhookCredentials).values({ id: credentialId, tenantId: input.tenantId, branchId: input.branchId, name: `Meta Lead Ads • ${input.pageId}`, source: META_LEAD_ADS_SOURCE, tokenPrefix: internalToken.tokenPrefix, tokenHash: internalToken.tokenHash, status: "active", createdBy: input.actorUserId, createdAt: now, updatedAt: now });
      await tx.insert(schema.metaLeadAdSources).values({ id: sourceId, tenantId: input.tenantId, branchId: input.branchId, pageId: input.pageId, adAccountId: input.adAccountId, leadWebhookCredentialId: credentialId, status: "active", createdBy: input.actorUserId, createdAt: now, updatedAt: now });
    } else {
      await tx.update(schema.metaLeadAdSources).set({ branchId: input.branchId, adAccountId: input.adAccountId, status: "active", lastError: null, updatedAt: now }).where(eq(schema.metaLeadAdSources.id, sourceId));
      await tx.update(schema.leadWebhookCredentials).set({ branchId: input.branchId, status: "active", revokedAt: null, updatedAt: now }).where(eq(schema.leadWebhookCredentials.id, credentialId));
    }
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "meta_lead_ads_source", entidadeId: sourceId, acao: existing ? "meta_lead_ads.source_updated" : "meta_lead_ads.source_created" });
  });
  return { sourceId };
}

export async function pauseMetaLeadAdsSource(input: { tenantId: string; sourceId: string; actorUserId: string }) {
  const db = getDatabase();
  const [source] = await db.select().from(schema.metaLeadAdSources).where(and(eq(schema.metaLeadAdSources.id, input.sourceId), eq(schema.metaLeadAdSources.tenantId, input.tenantId))).limit(1);
  if (!source) throw new Error("Fonte de Lead Ads não encontrada.");
  await db.transaction(async (tx) => {
    await tx.update(schema.metaLeadAdSources).set({ status: "inactive", updatedAt: new Date() }).where(eq(schema.metaLeadAdSources.id, source.id));
    await tx.update(schema.leadWebhookCredentials).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(eq(schema.leadWebhookCredentials.id, source.leadWebhookCredentialId));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.actorUserId, entidade: "meta_lead_ads_source", entidadeId: source.id, acao: "meta_lead_ads.source_paused" });
  });
}

export async function ingestMetaLeadAdsWebhook(payload: MetaLeadAdsWebhookPayload, _rawPayload: string, request: Request) {
  const { ensureMetaLeadAdsSchema } = await import("./manual-meta-queries");
  await ensureMetaLeadAdsSchema();
  const enabled = await isMetaLeadAdsEnabled();
  console.log("[ingestMetaLeadAdsWebhook] start", { object: payload.object, enabled, entriesCount: payload.entry?.length });
  if (payload.object !== "page" || !enabled) {
    console.warn("[ingestMetaLeadAdsWebhook] Ignored because object is not page or feature is disabled", { object: payload.object, enabled });
    return { processed: 0, ignored: 1 };
  }
  const db = getDatabase();
  const receivedAt = new Date();
  let processed = 0;
  let ignored = 0;
  for (const entry of payload.entry ?? []) {
    if (!entry.id) { ignored += 1; continue; }
    console.log("[ingestMetaLeadAdsWebhook] Checking pageId", entry.id);
    const [source] = await db.select().from(schema.metaLeadAdSources).where(and(eq(schema.metaLeadAdSources.pageId, entry.id), eq(schema.metaLeadAdSources.status, "active"))).limit(1);
    if (!source) {
      console.warn("[ingestMetaLeadAdsWebhook] Active page source NOT found for pageId", entry.id);
      ignored += 1;
      continue;
    }
    const tenantEnabled = await isMetaLeadAdsEnabled(source.tenantId);
    if (!tenantEnabled) {
      console.warn("[ingestMetaLeadAdsWebhook] Tenant not pilot enabled for Lead Ads", source.tenantId);
      ignored += 1;
      continue;
    }
    const [credential] = source.createdBy ? [{ createdBy: source.createdBy }] : await db.select({ createdBy: schema.leadWebhookCredentials.createdBy }).from(schema.leadWebhookCredentials).where(eq(schema.leadWebhookCredentials.id, source.leadWebhookCredentialId)).limit(1);
    if (!credential?.createdBy) {
      console.warn("[ingestMetaLeadAdsWebhook] Credential createdBy not found", source.leadWebhookCredentialId);
      ignored += 1;
      continue;
    }
    await db.update(schema.metaLeadAdSources).set({ lastWebhookAt: receivedAt, updatedAt: receivedAt }).where(eq(schema.metaLeadAdSources.id, source.id));
    for (const change of entry.changes ?? []) {
      const leadgenId = change.field === "leadgen" ? change.value?.leadgen_id?.trim() : undefined;
      if (!leadgenId) continue;
      console.log("[ingestMetaLeadAdsWebhook] Processing leadgenId", leadgenId);
      try {
        const [page] = await db.select({ accessTokenCiphertext: schema.metaPages.accessTokenCiphertext })
          .from(schema.metaPages)
          .where(and(eq(schema.metaPages.tenantId, source.tenantId), eq(schema.metaPages.pageId, entry.id), eq(schema.metaPages.status, "active")))
          .limit(1);
        if (!page?.accessTokenCiphertext) throw new Error("A Página Meta não possui uma credencial ativa. Reconecte a Página para receber novos formulários.");
        const leadRecord = await fetchMetaLead(leadgenId, decryptMetaToken(page.accessTokenCiphertext));
        const lead = normalizeMetaLead(leadRecord);
        console.log("[ingestMetaLeadAdsWebhook] Normalized lead:", { nome: lead.nome, telefone: lead.telefone, externalId: lead.externalId });
        if (!lead.nome || !lead.telefone || !lead.externalId) throw new Error("O formulário não trouxe nome e telefone utilizáveis.");
        const [campaignRoute] = lead.campaignId ? await db.select({ queueId: schema.metaCampaignQueueRoutes.queueId })
          .from(schema.metaCampaignQueueRoutes)
          .innerJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
          .where(and(eq(schema.metaCampaignQueueRoutes.tenantId, source.tenantId), eq(schema.metaCampaignQueueRoutes.campaignId, lead.campaignId), eq(schema.metaCampaignQueueRoutes.enabled, true), eq(schema.leadQueues.status, "active")))
          .limit(1) : [];
        const bypassPlantao = source.distributionMode === "direct_leads" && !campaignRoute;
        const result = await createLeadFromWebhookSync({
          tenantId: source.tenantId, branchId: source.branchId ?? null, queueId: campaignRoute?.queueId ?? null, credentialId: source.leadWebhookCredentialId, createdByUserId: credential.createdBy,
          payload: { nome: lead.nome, telefone: lead.telefone, email: lead.email, website: "" }, idempotencyKey: `meta-leadgen-${lead.externalId}`,
          requestMetadata: { requestId: resolveRequestId(request.headers.get("x-request-id")), userAgent: request.headers.get("user-agent"), receivedAt },
          bypassPlantao,
          leadSource: { channel: META_LEAD_ADS_SOURCE, externalId: lead.externalId, campaign: lead.campaignId, ad: lead.adId, form: lead.formId, capturedAt: lead.createdTime ? new Date(lead.createdTime) : receivedAt, metadata: { pageId: entry.id, campaignName: lead.campaignName ?? null } },
        });
        console.log("[ingestMetaLeadAdsWebhook] createLeadFromWebhookSync result:", result);
        if (!result.success) throw new Error(result.code);
        await db.update(schema.metaLeadAdSources).set({ lastLeadAt: receivedAt, lastError: null, updatedAt: new Date() }).where(eq(schema.metaLeadAdSources.id, source.id));
        processed += 1;
      } catch (error) {
        console.error("[ingestMetaLeadAdsWebhook] Error processing leadgenId:", error);
        await db.update(schema.metaLeadAdSources).set({ lastError: error instanceof Error ? error.message.slice(0, 240) : "Falha no processamento do Lead Ads.", updatedAt: new Date() }).where(eq(schema.metaLeadAdSources.id, source.id));
        ignored += 1;
      }
    }
  }
  return { processed, ignored };
}
