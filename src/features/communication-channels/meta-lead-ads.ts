import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { createLeadFromWebhookSync } from "@/features/leads/webhooks/services/create-lead-from-webhook-sync";
import { generateWebhookToken, resolveRequestId } from "@/features/leads/webhooks/utils/lead-webhook.utils";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import { decryptMetaToken } from "@/features/meta-ads/meta-oauth";
import { resolveMetaCampaignAttribution, resolveMetaCampaignQueueRoute } from "@/features/meta-ads/campaign-route-resolver";
import { runLeadDistributionProcessor } from "@/features/lead-distribution/jobs";
import { runLeadEffectOutboxProcessor } from "@/features/leads/webhooks/services/lead-effect-outbox";

import { MetaCloudApiError } from "./meta-cloud-client";
import { getMetaLeadAdsWebhookConfig } from "./meta-cloud-config";
import { isMetaLeadAdsTenantPilotEnabled } from "./meta-lead-ads-platform";
import { resolveMetaCapturePolicy } from "@/features/meta-ads/meta-capture-policy";

export { resolveMetaCapturePolicy as resolveMetaCampaignIntake } from "@/features/meta-ads/meta-capture-policy";

export type MetaLeadAdsWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: { leadgen_id?: string; form_id?: string; ad_id?: string } }>;
  }>;
};

type MetaLeadField = { name?: string; values?: string[] };
type MetaLeadAdRecord = { id?: string; created_time?: string; ad_id?: string; adset_id?: string; form_id?: string; campaign_id?: string; campaign_name?: string; page_id?: string; field_data?: MetaLeadField[] };
type LeadType = "PF" | "PJ" | "PME";

export const META_LEAD_ADS_SOURCE = "meta_lead_ads";

type ExistingMetaLeadAdsSource = {
  id: string;
  tenantId: string;
  leadWebhookCredentialId: string;
  status: string;
};

type MetaLeadAdsSourceClaim = "create" | "reuse" | "release_and_create";

/**
 * A Page may have historical inactive mappings, but only one active mapping.
 * This keeps the webhook tenant-safe while allowing a director to release a
 * disconnected Page and connect it to the correct brokerage later.
 */
export function resolveMetaLeadAdsSourceClaim(
  existing: ExistingMetaLeadAdsSource | undefined,
  tenantId: string,
  canReleaseDisconnectedOwner = false,
): MetaLeadAdsSourceClaim {
  if (!existing) return "create" as const;
  if (existing.tenantId === tenantId) return "reuse" as const;
  if (existing.status === "active" && canReleaseDisconnectedOwner) {
    return "release_and_create";
  }
  if (existing.status === "active") {
    throw new Error("Esta Página Meta já está conectada a outra empresa.");
  }
  return "create" as const;
}

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
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function firstField(fields: MetaLeadField[], names: string[]) {
  const match = fields.find((field) => field.name && names.includes(normalizeFieldName(field.name)));
  return match?.values?.find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
}

function normalizeLeadType(value: string): LeadType | undefined {
  const normalized = normalizeFieldName(value);
  if (["pf", "pessoa_fisica", "individual", "familiar", "plano_individual", "plano_familiar"].includes(normalized)) return "PF";
  if (["pj", "pessoa_juridica", "plano_pj"].includes(normalized)) return "PJ";
  if (["pme", "empresarial", "plano_pme", "plano_empresarial"].includes(normalized)) return "PME";
  return undefined;
}

const CONTACT_FIELD_NAMES = ["full_name", "nome", "name", "first_name", "primeiro_nome", "last_name", "sobrenome", "phone_number", "telefone", "phone", "celular", "whatsapp", "email", "email_address", "e_mail"];
const CNPJ_TYPE_FIELD_NAMES = ["tipo_de_cnpj", "tipo_cnpj", "cnpj_type"];
const PLAN_TYPE_FIELD_NAMES = [
  "tipo_de_plano", "tipo_plano", "plan_type", "tipo_de_produto", "tipo_produto",
  "categoria_do_plano", "modalidade_do_plano", "modalidade", "plano_produto",
  "plano_de_interesse", "plano_interesse", "produto_de_interesse", "plano", "produto",
];
const CARRIER_FIELD_NAMES = ["operadora", "operadora_de_preferencia", "operadora_preferida", "nome_da_operadora", "carrier", "health_insurance_company"];
const MAPPED_FIELD_NAMES = new Set([...CONTACT_FIELD_NAMES, ...CNPJ_TYPE_FIELD_NAMES, ...PLAN_TYPE_FIELD_NAMES, ...CARRIER_FIELD_NAMES]);

/**
 * Names (never answers — a form can ask health questions) of the questions
 * the mapping below doesn't recognize, so a renamed or new question shows up
 * on the lead instead of being dropped without a trace.
 */
function collectUnmappedQuestionNames(fields: MetaLeadField[]) {
  const names = fields
    .map((field) => field.name?.trim())
    .filter((name): name is string => Boolean(name) && !MAPPED_FIELD_NAMES.has(normalizeFieldName(name!)))
    .map((name) => name.slice(0, 120));
  return [...new Set(names)].slice(0, 40);
}

/** "você_tem_empresa?_" → "Você tem empresa?" */
export function formQuestionLabel(name: string) {
  const text = name.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : name;
}

/**
 * The client's answers to the questions the mapping doesn't recognize, as
 * "Pergunta: resposta", so the broker sees everything the client filled in on
 * the lead — nothing is discarded (decided by the business on 02/10). Answers
 * may include health data (sensitive under the LGPD): they live on the lead
 * only, are never logged and never go into a WhatsApp template.
 */
function collectUnmappedAnswers(fields: MetaLeadField[]) {
  const answers = fields
    .filter((field) => field.name?.trim() && !MAPPED_FIELD_NAMES.has(normalizeFieldName(field.name)))
    .map((field) => {
      const answer = (field.values ?? []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()).join(", ");
      return answer ? `${formQuestionLabel(field.name!.trim()).slice(0, 120)}: ${answer.replace(/_+/g, " ").slice(0, 300)}` : null;
    })
    .filter((entry): entry is string => Boolean(entry));
  return [...new Set(answers)].slice(0, 40);
}

/** Deterministic field mapping; unknown form answers are never sent to logs. */
export function normalizeMetaLead(record: MetaLeadAdRecord) {
  const fields = record.field_data ?? [];
  let nome = firstField(fields, ["full_name", "nome", "name"]) || [firstField(fields, ["first_name", "primeiro_nome"]), firstField(fields, ["last_name", "sobrenome"])].filter(Boolean).join(" ");
  let telefone = firstField(fields, ["phone_number", "telefone", "phone", "celular", "whatsapp"]);
  let email = firstField(fields, ["email", "email_address", "e_mail"]);
  const tipoCnpj = firstField(fields, CNPJ_TYPE_FIELD_NAMES).slice(0, 120);
  const tipoPlano = firstField(fields, PLAN_TYPE_FIELD_NAMES).slice(0, 120);
  const operadora = firstField(fields, CARRIER_FIELD_NAMES).slice(0, 120);
  // A CNPJ type (MEI, ME, LTDA…) means a company plan even when the form has
  // no explicit plan-type question.
  const leadType = (tipoPlano ? normalizeLeadType(tipoPlano) : undefined) ?? (tipoCnpj ? "PME" : undefined);
  const unmappedFormFields = collectUnmappedQuestionNames(fields);
  const formAnswers = collectUnmappedAnswers(fields);

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

  const normalized = {
    nome, telefone, email,
    externalId: record.id ?? "",
    campaignId: record.campaign_id ?? null,
    campaignName: record.campaign_name ?? null,
    adId: record.ad_id ?? null,
    formId: record.form_id ?? null,
    /** ISO 8601 retornado pela Meta — quando o lead foi realmente capturado no anúncio. */
    createdTime: record.created_time ?? null,
  };
  return {
    ...normalized,
    ...(tipoCnpj ? { tipoCnpj } : {}),
    ...(tipoPlano ? { tipoPlano } : {}),
    ...(operadora ? { operadora } : {}),
    ...(leadType ? { leadType } : {}),
    ...(unmappedFormFields.length ? { unmappedFormFields } : {}),
    ...(formAnswers.length ? { formAnswers } : {}),
    ...(record.adset_id ? { adSetId: record.adset_id } : {}),
    ...(record.page_id ? { pageId: record.page_id } : {}),
  };
}

export async function fetchMetaLead(leadgenId: string, tenantAccessToken: string): Promise<MetaLeadAdRecord> {
  const config = getMetaLeadAdsWebhookConfig();
  // Keep this request limited to fields supported by the Meta Lead object.
  // The webhook entry already identifies the Page, so requesting page_id here
  // is unnecessary and causes Meta to reject the whole lead lookup.
  const response = await fetch(`https://graph.facebook.com/${config.graphVersion}/${encodeURIComponent(leadgenId)}?fields=id,created_time,ad_id,adset_id,form_id,campaign_id,campaign_name,field_data`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${tenantAccessToken}` }, cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as MetaLeadAdRecord & { error?: { message?: string; code?: number } };
  if (!response.ok) throw new MetaCloudApiError(
    "A Meta não permitiu carregar os detalhes deste lead. Ele não foi criado no CRM.",
    response.status,
    payload.error?.code,
  );
  return payload;
}

/**
 * Limite de chamadas ou instabilidade da Meta ao buscar o lead: o webhook não pode
 * confirmar a entrega, senão a Meta não reenvia e o lead se perde. Respondendo
 * erro, a Meta reentrega; a chave de idempotência evita duplicar o lead.
 */
export function isRetryableMetaLeadLookupError(error: unknown): boolean {
  if (!(error instanceof MetaCloudApiError)) return false;
  const code = error.code ?? 0;
  return [4, 17, 32, 613].includes(code) || (code >= 80000 && code <= 80014) || error.status === 429 || error.status >= 500;
}

/** Processes only this lead's durable work; the daily cron remains its recovery path. */
async function processMetaLeadImmediately(input: { tenantId: string; leadId: string }) {
  await runLeadEffectOutboxProcessor({ tenantId: input.tenantId, leadId: input.leadId, limit: 3 });
  await runLeadDistributionProcessor({ tenantId: input.tenantId, leadId: input.leadId, limit: 1 });
}

export async function configureMetaLeadAdsSource(input: { tenantId: string; branchId: string | null; pageId: string; adAccountId: string | null; actorUserId: string; leadgenSubscriptionVerified: true }) {
  if (input.leadgenSubscriptionVerified !== true) {
    throw new Error("Meta source cannot be activated without a confirmed leadgen subscription.");
  }
  const db = getDatabase();
  const now = new Date();
  const [activeSource] = await db.select().from(schema.metaLeadAdSources)
    .where(and(eq(schema.metaLeadAdSources.pageId, input.pageId), eq(schema.metaLeadAdSources.status, "active")))
    .limit(1);
  const [tenantSource] = activeSource?.tenantId === input.tenantId
    ? [activeSource]
    : await db.select().from(schema.metaLeadAdSources)
      .where(and(eq(schema.metaLeadAdSources.pageId, input.pageId), eq(schema.metaLeadAdSources.tenantId, input.tenantId)))
      .orderBy(desc(schema.metaLeadAdSources.updatedAt))
      .limit(1);

  // Versions released before the canonical Marketing disconnect could leave an
  // active source behind. It is safe to release only when the source's owner
  // has an explicit disconnected connection for the same Page; manual sources
  // without that evidence remain protected from cross-tenant takeover.
  const [ownerConnection] = activeSource && activeSource.tenantId !== input.tenantId
    ? await db.select({ status: schema.metaConnections.status })
      .from(schema.metaPages)
      .innerJoin(schema.metaConnections, eq(schema.metaPages.connectionId, schema.metaConnections.id))
      .where(and(
        eq(schema.metaPages.tenantId, activeSource.tenantId),
        eq(schema.metaPages.pageId, input.pageId),
      ))
      .orderBy(desc(schema.metaConnections.updatedAt))
      .limit(1)
    : [];
  const claim = resolveMetaLeadAdsSourceClaim(
    activeSource,
    input.tenantId,
    ownerConnection?.status === "disconnected",
  );
  const existing = tenantSource;
  const sourceId = existing?.id ?? randomUUID();
  const credentialId = existing?.leadWebhookCredentialId ?? randomUUID();
  await db.transaction(async (tx) => {
    if (claim === "release_and_create" && activeSource) {
      await tx.update(schema.metaLeadAdSources)
        .set({ status: "inactive", updatedAt: now })
        .where(and(
          eq(schema.metaLeadAdSources.id, activeSource.id),
          eq(schema.metaLeadAdSources.tenantId, activeSource.tenantId),
          eq(schema.metaLeadAdSources.status, "active"),
        ));
      await tx.update(schema.leadWebhookCredentials)
        .set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(and(
          eq(schema.leadWebhookCredentials.id, activeSource.leadWebhookCredentialId),
          eq(schema.leadWebhookCredentials.tenantId, activeSource.tenantId),
        ));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: input.actorUserId, entidade: "meta_lead_ads_source", entidadeId: activeSource.id,
        acao: "meta_lead_ads.source_released_after_owner_disconnect", createdAt: now,
      });
    }
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
  let retryable = 0;
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
        // If the payload omits campaign_id, recover it from this tenant's ad
        // hierarchy or a uniquely attributed form; shared forms stay ambiguous.
        const attribution = await resolveMetaCampaignAttribution({
          tenantId: source.tenantId,
          campaignId: lead.campaignId,
          adId: lead.adId,
          formId: lead.formId,
        });
        const campaignId = attribution.campaignId;
        const adSetId = lead.adSetId ?? attribution.adSetId;
        console.log("[ingestMetaLeadAdsWebhook] Normalized lead:", { nome: lead.nome, telefone: lead.telefone, externalId: lead.externalId });
        if (!lead.nome || !lead.telefone || !lead.externalId) throw new Error("O formulário não trouxe nome e telefone utilizáveis.");
        const campaignRoute = campaignId
          ? await resolveMetaCampaignQueueRoute(source.tenantId, campaignId)
          : undefined;
        const [anyCampaignRoute] = await db.select({ id: schema.metaCampaignQueueRoutes.id })
          .from(schema.metaCampaignQueueRoutes)
          .where(eq(schema.metaCampaignQueueRoutes.tenantId, source.tenantId))
          .limit(1);
        const { getSystemSetting } = await import("@/features/system-settings/queries");
        const storedGlobalMode = await getSystemSetting(`meta_lead_capture_mode_${source.tenantId}`);
        const hasTenantRules = Boolean(anyCampaignRoute);
        const globalMode: "all" | "selective" | "disabled" = storedGlobalMode === "disabled" || storedGlobalMode === "all" || storedGlobalMode === "selective"
          ? storedGlobalMode
          : (hasTenantRules ? "selective" : "all");

        const campaignIntake = resolveMetaCapturePolicy({ campaignRoute, globalMode, hasTenantRules });
        if (campaignIntake.action === "ignore") {
          await db.insert(schema.auditLogs).values({
            id: randomUUID(), userId: credential.createdBy, entidade: "meta_campaign_queue_route", entidadeId: campaignId ?? lead.externalId,
            acao: globalMode === "disabled"
              ? "meta_lead_ads.capture_globally_paused"
              : campaignRoute?.enabled
                ? "meta_lead_ads.campaign_missing_active_queue"
                : "meta_lead_ads.campaign_not_enabled",
            createdAt: receivedAt,
          });
          ignored += 1;
          continue;
        }
        const bypassPlantao = source.distributionMode === "direct_leads" && !campaignIntake.queueId;
        const result = await createLeadFromWebhookSync({
          tenantId: source.tenantId, branchId: source.branchId ?? null, queueId: campaignIntake.queueId, credentialId: source.leadWebhookCredentialId, createdByUserId: credential.createdBy,
          payload: { nome: lead.nome, telefone: lead.telefone, email: lead.email, website: "" }, idempotencyKey: `meta-leadgen-${lead.externalId}`,
          requestMetadata: { requestId: resolveRequestId(request.headers.get("x-request-id")), userAgent: request.headers.get("user-agent"), receivedAt },
          bypassPlantao,
          leadSource: {
            channel: META_LEAD_ADS_SOURCE,
            externalId: lead.externalId,
            campaign: campaignId,
            ad: lead.adId,
            form: lead.formId,
            adSet: adSetId,
            page: lead.pageId ?? entry.id,
            capturedAt: lead.createdTime ? new Date(lead.createdTime) : receivedAt,
            ...(lead.leadType ? { leadType: lead.leadType } : {}),
            metadata: {
              pageId: lead.pageId ?? entry.id,
              campaignResolution: attribution.resolvedBy,
              campaignName: lead.campaignName ?? null,
              tipoPlano: lead.tipoPlano ?? null,
              tipoPlanoStatus: lead.tipoPlano ? "provided" : "not_provided",
              tipoCnpj: lead.tipoCnpj ?? null,
              operadora: lead.operadora ?? null,
              unmappedFormFields: lead.unmappedFormFields ?? null,
              formAnswers: lead.formAnswers ?? null,
            },
          },
        });
        console.log("[ingestMetaLeadAdsWebhook] createLeadFromWebhookSync result:", result);
        if (!result.success) throw new Error(result.code);
        try {
          await processMetaLeadImmediately({ tenantId: source.tenantId, leadId: result.leadId });
        } catch (error) {
          // The lead is durable and the outbox retries it later; do not induce a duplicate Meta delivery.
          console.error("[meta-lead-ads] immediate processing deferred", {
            leadId: result.leadId,
            message: error instanceof Error ? error.message.slice(0, 160) : "unexpected_error",
          });
        }
        await db.update(schema.metaLeadAdSources).set({ lastLeadAt: receivedAt, lastError: null, updatedAt: new Date() }).where(eq(schema.metaLeadAdSources.id, source.id));
        processed += 1;
      } catch (error) {
        console.error("[ingestMetaLeadAdsWebhook] Error processing leadgenId:", error);
        const canRetry = isRetryableMetaLeadLookupError(error);
        const lastError = canRetry
          ? "A Meta limitou as chamadas ao buscar um lead; a entrega foi recusada para a Meta reenviar."
          : error instanceof Error ? error.message.slice(0, 240) : "Falha no processamento do Lead Ads.";
        await db.update(schema.metaLeadAdSources).set({ lastError, updatedAt: new Date() }).where(eq(schema.metaLeadAdSources.id, source.id));
        if (canRetry) retryable += 1;
        else ignored += 1;
      }
    }
  }
  return { processed, ignored, retryable };
}
