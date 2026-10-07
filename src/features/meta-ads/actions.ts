"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { decryptMetaToken, encryptMetaToken } from "./meta-oauth";
import { consumeMetaConnectionAttempt, readVerifiedMetaConnectionAttempt } from "./meta-connection-attempts";
import { startMetaMarketingConnection } from "./meta-marketing-connection-service";
import { runMetaTenantSync } from "./meta-sync-service";
import { configureMetaLeadAdsSource } from "@/features/communication-channels/meta-lead-ads";
import { resolvePageAccessToken, subscribePageToLeadgen } from "@/features/communication-channels/meta-cloud-client";
import { resolveMetaCapturePolicy } from "./meta-capture-policy";
import { resolveMetaCampaignQueueRoute } from "./campaign-route-resolver";
import { indexInheritedCampaignIdsByForm } from "./meta-capture-inheritance";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaDiscoveredAssets, MetaSyncLogItem, MetaSyncWarning } from "./types";

/** Obter estado atual da conexão Meta do tenant */
export async function getMetaConnectionState(): Promise<{
  connection: MetaConnectionInfo | null;
  assets: MetaConnectionAssets | null;
  logs: MetaSyncLogItem[];
  isConfigured: boolean;
}> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [connection] = await db
    .select()
    .from(schema.metaConnections)
    .where(eq(schema.metaConnections.tenantId, context.tenantId))
    .orderBy(desc(schema.metaConnections.updatedAt))
    .limit(1);

  if (!connection) {
    return {
      connection: null,
      assets: null,
      logs: [],
      isConfigured: false,
    };
  }

  const { getSystemSetting } = await import("@/features/system-settings/queries");
  const storedGlobalMode = await getSystemSetting(`meta_lead_capture_mode_${context.tenantId}`).catch(() => null);

  const [pages, adAccounts, pixels, datasets, leadForms, campaigns, adSets, ads, logs, campaignRoutes, leadAttributions] = await Promise.all([
    db.select({ id: schema.metaPages.pageId, name: schema.metaPages.name, status: schema.metaPages.status }).from(schema.metaPages).where(and(eq(schema.metaPages.tenantId, context.tenantId), eq(schema.metaPages.status, "active"))).orderBy(schema.metaPages.name),
    db.select({ id: schema.metaAdAccounts.adAccountId, name: schema.metaAdAccounts.name, currency: schema.metaAdAccounts.currency, status: schema.metaAdAccounts.status, defaultQueueId: schema.metaAdAccounts.defaultQueueId, defaultQueueName: schema.leadQueues.name, defaultQueueStatus: schema.leadQueues.status }).from(schema.metaAdAccounts).leftJoin(schema.leadQueues, and(eq(schema.leadQueues.id, schema.metaAdAccounts.defaultQueueId), eq(schema.leadQueues.tenantId, schema.metaAdAccounts.tenantId))).where(and(eq(schema.metaAdAccounts.tenantId, context.tenantId), eq(schema.metaAdAccounts.status, "active"))).orderBy(schema.metaAdAccounts.name),
    db.select({ id: schema.metaPixels.pixelId, name: schema.metaPixels.name, status: schema.metaPixels.status }).from(schema.metaPixels).where(and(eq(schema.metaPixels.tenantId, context.tenantId), eq(schema.metaPixels.status, "active"))).orderBy(schema.metaPixels.name),
    db.select({ id: schema.metaDatasets.datasetId, name: schema.metaDatasets.name, status: schema.metaDatasets.status }).from(schema.metaDatasets).where(and(eq(schema.metaDatasets.tenantId, context.tenantId), eq(schema.metaDatasets.status, "active"))).orderBy(schema.metaDatasets.name),
    db.select({ id: schema.metaLeadForms.formId, name: schema.metaLeadForms.name, status: schema.metaLeadForms.status, pageId: schema.metaLeadForms.pageId }).from(schema.metaLeadForms).where(eq(schema.metaLeadForms.tenantId, context.tenantId)).orderBy(schema.metaLeadForms.name),
    db.select({ id: schema.metaCampaigns.campaignId, name: schema.metaCampaigns.name, status: schema.metaCampaigns.status, adAccountId: schema.metaCampaigns.adAccountId }).from(schema.metaCampaigns).where(eq(schema.metaCampaigns.tenantId, context.tenantId)).orderBy(schema.metaCampaigns.name),
    db.select({ id: schema.metaAdSets.adSetId, campaignId: schema.metaAdSets.campaignId }).from(schema.metaAdSets).where(eq(schema.metaAdSets.tenantId, context.tenantId)),
    db.select({ id: schema.metaAds.adId, name: schema.metaAds.name, status: schema.metaAds.status, adSetId: schema.metaAds.adSetId }).from(schema.metaAds).where(eq(schema.metaAds.tenantId, context.tenantId)).orderBy(schema.metaAds.name),
    db.select().from(schema.metaSyncLogs).where(eq(schema.metaSyncLogs.tenantId, context.tenantId)).orderBy(desc(schema.metaSyncLogs.startedAt)).limit(60),
    db.select({ campaignId: schema.metaCampaignQueueRoutes.campaignId, enabled: schema.metaCampaignQueueRoutes.enabled, queueId: schema.metaCampaignQueueRoutes.queueId, queueStatus: schema.leadQueues.status })
      .from(schema.metaCampaignQueueRoutes)
      .leftJoin(schema.leadQueues, and(eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id), eq(schema.metaCampaignQueueRoutes.tenantId, schema.leadQueues.tenantId)))
      .where(eq(schema.metaCampaignQueueRoutes.tenantId, context.tenantId)).catch(() => []),
    db.selectDistinct({ formId: schema.leads.metaFormId, campaignId: schema.leads.metaCampaignId })
      .from(schema.leads)
      .innerJoin(schema.metaCampaignQueueRoutes, and(
        eq(schema.metaCampaignQueueRoutes.tenantId, schema.leads.tenantId),
        eq(schema.metaCampaignQueueRoutes.campaignId, schema.leads.metaCampaignId),
        eq(schema.metaCampaignQueueRoutes.enabled, true),
      ))
      .innerJoin(schema.leadQueues, and(
        eq(schema.leadQueues.tenantId, schema.metaCampaignQueueRoutes.tenantId),
        eq(schema.leadQueues.id, schema.metaCampaignQueueRoutes.queueId),
        eq(schema.leadQueues.status, "active"),
      ))
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        isNotNull(schema.leads.metaFormId),
        isNotNull(schema.leads.metaCampaignId),
      ))
      .catch(() => []),
  ]);

  const activeAccountIds = new Set(adAccounts.map((account) => account.id));
  const activePageIds = new Set(pages.map((page) => page.id));

  const campaignRouteMap = new Map(campaignRoutes.map((route) => [route.campaignId, route]));
  const defaultRoutesByAccount = new Map(adAccounts
    .filter((account) => account.defaultQueueId && account.defaultQueueStatus === "active")
    .map((account) => [account.id, {
      queueId: account.defaultQueueId!,
      queueName: account.defaultQueueName,
      queueStatus: account.defaultQueueStatus,
    }]));
  for (const campaign of campaigns) {
    const defaultRoute = defaultRoutesByAccount.get(campaign.adAccountId);
    if (!defaultRoute) continue;
    const existingRoute = campaignRouteMap.get(campaign.id);
    if (!existingRoute) {
      campaignRouteMap.set(campaign.id, { campaignId: campaign.id, enabled: true, ...defaultRoute });
    } else if (!existingRoute.queueId) {
      campaignRouteMap.set(campaign.id, { ...existingRoute, ...defaultRoute });
    }
  }
  const inheritedCampaignIdsByForm = indexInheritedCampaignIdsByForm(
    leadAttributions,
    new Set(campaignRoutes.filter((route) => route.enabled && route.queueId && route.queueStatus === "active").map((route) => route.campaignId)),
  );

  const globalCaptureMode: "all" | "selective" | "disabled" = storedGlobalMode === "disabled" || storedGlobalMode === "all" || storedGlobalMode === "selective"
    ? storedGlobalMode
    : "selective";

  const activeCampaignCandidates = campaigns.filter((campaign) => activeAccountIds.has(campaign.adAccountId));
  const activeCampaignCandidateIds = new Set(activeCampaignCandidates.map((campaign) => campaign.id));
  const activeAdSets = adSets.filter((adSet) => activeCampaignCandidateIds.has(adSet.campaignId));
  const activeAdSetIds = new Set(activeAdSets.map((adSet) => adSet.id));
  const adSetCampaignMap = new Map(activeAdSets.map((adSet) => [adSet.id, adSet.campaignId]));
  const activeCampaigns = activeCampaignCandidates.map((c) => ({
    ...c,
    isEligibleForCapture: resolveMetaCapturePolicy({
      campaignRoute: campaignRouteMap.get(c.id),
      globalMode: globalCaptureMode,
    }).action === "capture",
  }));

  const filteredAds = ads
    .filter((ad) => activeAdSetIds.has(ad.adSetId))
    .map((ad) => {
      const campaignId = adSetCampaignMap.get(ad.adSetId) ?? null;
      const campaignRoute = campaignId ? campaignRouteMap.get(campaignId) : undefined;
      return {
        ...ad,
        campaignId,
        isEligibleForCapture: resolveMetaCapturePolicy({
          campaignRoute,
          globalMode: globalCaptureMode,
        }).action === "capture",
        inheritedFromCampaignId: campaignRoute?.enabled && globalCaptureMode !== "disabled" && campaignRoute.queueId && campaignRoute.queueStatus === "active"
          ? campaignId
          : null,
      };
    });

  const filteredLeadForms = leadForms
    .filter((form) => activePageIds.has(form.pageId))
    .map((form) => {
      const inheritedCampaignIds = inheritedCampaignIdsByForm.get(form.id) ?? [];
      return {
        ...form,
        isEligibleForCapture: inheritedCampaignIds.length > 0 && globalCaptureMode !== "disabled",
        inheritedFromCampaignIds: inheritedCampaignIds,
      };
    });

  const assets: MetaConnectionAssets = {
    pages,
    adAccounts,
    pixels,
    datasets,
    leadForms: filteredLeadForms,
    campaigns: activeCampaigns,
    ads: filteredAds,
  };

  const connectionStatus: MetaConnectionInfo["status"] = connection.status === "connected"
    || connection.status === "disconnected"
    || connection.status === "expired"
    || connection.status === "error"
    ? connection.status
    : "error";
  const connInfo: MetaConnectionInfo = {
    id: connection.id,
    tenantId: connection.tenantId,
    businessId: connection.businessId,
    businessName: connection.businessName,
    status: connectionStatus,
    permissions: (connection.permissions as string[]) || [],
    expiresAt: connection.expiresAt,
    lastError: connection.lastError,
    lastSyncedAt: connection.lastSyncedAt,
    pagesCount: pages.length,
    adAccountsCount: adAccounts.length,
    whatsappConnected: false,
    globalCaptureMode,
  };

  return {
    connection: connInfo,
    assets,
    logs: logs.map((l) => ({
      id: l.id,
      syncType: l.syncType,
      status: l.status,
      itemsSynced: l.itemsSynced,
      errorDetails: l.errorDetails,
      durationMs: l.durationMs,
      startedAt: l.startedAt,
      completedAt: l.completedAt,
    })),
    isConfigured: connection.status === "connected",
  };
}

/** Descobrir ativos Meta via token/código de auth */

export async function beginMetaMarketingConnection() {
  return startMetaMarketingConnection();
}

export async function getMetaMarketingAttemptAssets(attemptId: string): Promise<MetaDiscoveredAssets> {
  const context = await getRequiredTenantContext();
  const attempt = await readVerifiedMetaConnectionAttempt({ attemptId, tenantId: context.tenantId, userId: context.userId });
  const assets = attempt.assetSnapshot as MetaDiscoveredAssets;
  // The UI needs identifiers and labels only. Credentials remain server-only.
  return { ...assets, pages: assets.pages.map(({ id, name }) => ({ id, name })) };
}

/** Descobrir ativos Meta fornecendo o Access Token diretamente */

/** Salva/Confirma a conexão Meta do tenant com os ativos selecionados */
export async function confirmMetaConnection(payload: {
  attemptId: string;
  businessId: string;
  businessName: string;
  pages: Array<{ id: string; name: string }>;
  adAccounts: Array<{ id: string; name: string; currency: string }>;
}): Promise<{ success: boolean; error?: string }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.jobTitle !== "marketing" && context.role !== "manager") {
    throw new Error("Apenas Diretores ou Marketing podem configurar integrações com a Meta.");
  }

  const db = getDatabase();
  const now = new Date();

  const attempt = await readVerifiedMetaConnectionAttempt({ attemptId: payload.attemptId, tenantId: context.tenantId, userId: context.userId });
  const tokenCiphertext = attempt.accessTokenCiphertext;
  if (!tokenCiphertext) throw new Error("A autorização Meta não contém uma credencial válida.");
  const authorizedAssets = attempt.assetSnapshot as MetaDiscoveredAssets;
  if (authorizedAssets.business.id !== payload.businessId) throw new Error("A empresa selecionada não pertence à autorização atual da Meta.");
  const authorizedPages = new Map(authorizedAssets.pages.map((page) => [page.id, page]));
  const authorizedAccounts = new Map(authorizedAssets.adAccounts.map((account) => [account.id, account]));
  if (payload.pages.some((page) => !authorizedPages.has(page.id)) || payload.adAccounts.some((account) => !authorizedAccounts.has(account.id))) {
    throw new Error("Um ativo selecionado não pertence à autorização atual da Meta.");
  }
  const expiresAt = attempt.tokenExpiresAt;
  const connectionId = randomUUID();
  const accessToken = decryptMetaToken(tokenCiphertext);

  const pageTokenCiphertexts = new Map<string, string>();
  for (const page of payload.pages) {
    const pageAccessToken = await resolvePageAccessToken(page.id, accessToken);
    await subscribePageToLeadgen(page.id, pageAccessToken);
    pageTokenCiphertexts.set(page.id, encryptMetaToken(pageAccessToken));
  }

  // 1. Inserir ou atualizar meta_connections
  const [existing] = await db
    .select({ id: schema.metaConnections.id })
    .from(schema.metaConnections)
    .where(and(
      eq(schema.metaConnections.tenantId, context.tenantId),
      eq(schema.metaConnections.businessId, payload.businessId),
    ))
    .limit(1);

  if (existing) {
    await db
      .update(schema.metaConnections)
      .set({
        businessId: payload.businessId,
        businessName: authorizedAssets.business.name,
        accessTokenCiphertext: tokenCiphertext,
        expiresAt,
        status: "connected",
        permissions: authorizedAssets.permissions ?? [],
        lastError: null,
        updatedAt: now,
      })
      .where(eq(schema.metaConnections.id, existing.id));
  } else {
    await db.insert(schema.metaConnections).values({
      id: connectionId,
      tenantId: context.tenantId,
      businessId: payload.businessId,
      businessName: authorizedAssets.business.name,
      accessTokenCiphertext: tokenCiphertext,
      expiresAt,
      status: "connected",
      permissions: authorizedAssets.permissions ?? [],
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  const activeConnectionId = existing?.id || connectionId;

  // A new authorization may expose assets unrelated to the brokerage. Only the
  // explicit selections in this confirmation stay active for this connection.
  // This also removes leftovers from an earlier, broader OAuth confirmation.
  await db.update(schema.metaPages)
    .set({ status: "inactive", updatedAt: now })
    .where(and(eq(schema.metaPages.tenantId, context.tenantId), eq(schema.metaPages.connectionId, activeConnectionId), eq(schema.metaPages.status, "active")));
  await db.update(schema.metaAdAccounts)
    .set({ status: "inactive", updatedAt: now })
    .where(and(eq(schema.metaAdAccounts.tenantId, context.tenantId), eq(schema.metaAdAccounts.connectionId, activeConnectionId), eq(schema.metaAdAccounts.status, "active")));
  // Pixels and datasets are cache-only mirrors. Marking the previous snapshot
  // inactive prevents old, unselected assets from remaining selectable after a
  // Director narrows the connection. Leads and routing history are untouched.
  await db.update(schema.metaPixels)
    .set({ status: "inactive", updatedAt: now })
    .where(and(eq(schema.metaPixels.tenantId, context.tenantId), eq(schema.metaPixels.status, "active")));
  await db.update(schema.metaDatasets)
    .set({ status: "inactive", updatedAt: now })
    .where(and(eq(schema.metaDatasets.tenantId, context.tenantId), eq(schema.metaDatasets.status, "active")));

  // 2. Salvar Páginas
  for (const page of payload.pages) {
    await db
      .insert(schema.metaPages)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        connectionId: activeConnectionId,
        pageId: page.id,
        name: authorizedPages.get(page.id)!.name,
        accessTokenCiphertext: pageTokenCiphertexts.get(page.id)!,
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.metaPages.tenantId, schema.metaPages.pageId],
        set: { name: authorizedPages.get(page.id)!.name, accessTokenCiphertext: pageTokenCiphertexts.get(page.id)!, status: "active", updatedAt: now },
      });
  }

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_connection",
    entidadeId: activeConnectionId,
    acao: "meta_connection_assets_explicitly_scoped",
    createdAt: now,
  });

  // 3. Salvar Contas de Anúncios
  for (const adAcc of payload.adAccounts) {
    await db
      .insert(schema.metaAdAccounts)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        connectionId: activeConnectionId,
        adAccountId: adAcc.id,
        name: authorizedAccounts.get(adAcc.id)!.name,
        currency: authorizedAccounts.get(adAcc.id)!.currency || "BRL",
        status: "active",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.metaAdAccounts.tenantId, schema.metaAdAccounts.adAccountId],
        set: { name: authorizedAccounts.get(adAcc.id)!.name, currency: authorizedAccounts.get(adAcc.id)!.currency || "BRL", status: "active", updatedAt: now },
      });
  }

  // 4. Create the tenant-scoped Lead Ads source after the selected Page has
  // accepted the subscription. WhatsApp stays in its own Embedded Signup flow.
  for (const page of payload.pages) {
    await configureMetaLeadAdsSource({
      tenantId: context.tenantId,
      branchId: null,
      pageId: page.id,
      adAccountId: null,
      actorUserId: context.userId,
      leadgenSubscriptionVerified: true,
    });
  }

  // 5. Registrar auditoria
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_connection",
    entidadeId: activeConnectionId,
    acao: "meta_connection_configured",
    createdAt: now,
  });

  // 6. Rodar primeira sincronização
  await runMetaTenantSync(context.tenantId, "full");
  await consumeMetaConnectionAttempt(attempt.id);


  return { success: true };
}

/** Desconectar integração Meta */
export async function disconnectMetaConnection(): Promise<{ success: boolean }> {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.jobTitle !== "marketing" && context.role !== "manager") {
    throw new Error("Apenas Diretores ou Marketing podem desconectar integrações.");
  }

  const db = getDatabase();
  const now = new Date();
  await db.transaction(async (tx) => {
    const sources = await tx
      .select({ id: schema.metaLeadAdSources.id, leadWebhookCredentialId: schema.metaLeadAdSources.leadWebhookCredentialId })
      .from(schema.metaLeadAdSources)
      .where(and(eq(schema.metaLeadAdSources.tenantId, context.tenantId), eq(schema.metaLeadAdSources.status, "active")));

    await tx
      .update(schema.metaConnections)
      .set({ status: "disconnected", updatedAt: now })
      .where(eq(schema.metaConnections.tenantId, context.tenantId));
    await tx
      .update(schema.metaPages)
      .set({ status: "inactive", updatedAt: now })
      .where(eq(schema.metaPages.tenantId, context.tenantId));
    await tx
      .update(schema.metaAdAccounts)
      .set({ status: "inactive", updatedAt: now })
      .where(eq(schema.metaAdAccounts.tenantId, context.tenantId));
    await tx
      .update(schema.metaCampaigns)
      .set({ status: "ARCHIVED", updatedAt: now })
      .where(eq(schema.metaCampaigns.tenantId, context.tenantId));
    await tx
      .update(schema.metaPixels)
      .set({ status: "inactive", updatedAt: now })
      .where(eq(schema.metaPixels.tenantId, context.tenantId));
    await tx
      .update(schema.metaDatasets)
      .set({ status: "inactive", updatedAt: now })
      .where(eq(schema.metaDatasets.tenantId, context.tenantId));

    for (const source of sources) {
      await tx.update(schema.metaLeadAdSources).set({ status: "inactive", updatedAt: now })
        .where(and(eq(schema.metaLeadAdSources.id, source.id), eq(schema.metaLeadAdSources.tenantId, context.tenantId)));
      await tx.update(schema.leadWebhookCredentials).set({ status: "revoked", revokedAt: now, updatedAt: now })
        .where(and(eq(schema.leadWebhookCredentials.id, source.leadWebhookCredentialId), eq(schema.leadWebhookCredentials.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "meta_lead_ads_source", entidadeId: source.id,
        acao: "meta_lead_ads.source_released_on_marketing_disconnect", createdAt: now,
      });
    }

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "meta_connection",
      entidadeId: context.tenantId,
      acao: "meta_connection_disconnected",
      createdAt: now,
    });
  });

  return { success: true };
}

/** Telemetria das etapas do onboarding de Marketing da Meta (funnel). */
export async function recordMetaMarketingOnboardingStep(step: string) {
  const context = await getRequiredTenantContext();
  await getDatabase().insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "meta_connection_attempt",
    entidadeId: context.tenantId,
    acao: `meta_onboarding.${step}`,
    createdAt: new Date(),
  });
}

/** Disparar sincronização manual */
export async function triggerManualMetaSync(): Promise<{ success: boolean; itemsSynced: number; error?: string; warnings?: MetaSyncWarning[] }> {
  const context = await getRequiredTenantContext();
  const res = await runMetaTenantSync(context.tenantId, "full");
  return res;
}

/** Obter relatório de auditoria de sincronização Meta */
export async function getMetaSyncDiagnosticAction() {
  const { getMetaSyncAuditDiagnostic } = await import("./meta-diagnostic-service");
  const context = await getRequiredTenantContext();
  return getMetaSyncAuditDiagnostic(context.tenantId);
}

async function ensureCaptureModeActiveIfDisabled(tenantId: string) {
  const { getSystemSetting, setSystemSetting } = await import("@/features/system-settings/queries");
  const stored = await getSystemSetting(`meta_lead_capture_mode_${tenantId}`).catch(() => null);
  if (stored === "disabled" || !stored) {
    await setSystemSetting(`meta_lead_capture_mode_${tenantId}`, "selective");
  }
}

/** Alternar elegibilidade de captura de leads da campanha */
export async function toggleMetaCampaignCaptureEligibilityAction(input: {
  campaignId: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [campaign] = await db
      .select({ id: schema.metaCampaigns.id, campaignId: schema.metaCampaigns.campaignId })
      .from(schema.metaCampaigns)
      .where(
        and(
          eq(schema.metaCampaigns.tenantId, context.tenantId),
          or(eq(schema.metaCampaigns.id, input.campaignId), eq(schema.metaCampaigns.campaignId, input.campaignId))
        )
      )
      .limit(1);

    if (!campaign) {
      return { success: false, error: "Campanha Meta não encontrada." };
    }

    let campaignQueueId: string | null = null;
    if (input.enabled) {
      // Turning capture on keeps the campaign's saved queue: it must be an
      // active one, or every lead would arrive with no queue.
      const route = await resolveMetaCampaignQueueRoute(context.tenantId, campaign.campaignId);
      if (route?.queueId && route.queueStatus !== "active") {
        return { success: false, error: `A fila desta campanha ("${route.queueName ?? "removida"}") está desativada. Escolha uma fila ativa para a campanha antes de ligar a captura.` };
      }
      if (!route?.queueId) {
        return { success: false, error: "Esta campanha não tem fila. Escolha a fila da campanha antes de ligar a captura: os leads entrariam sem fila." };
      }
      campaignQueueId = route.queueId;
      await ensureCaptureModeActiveIfDisabled(context.tenantId);
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      // This campaign rule is inherited by ads and by forms on leads whose Meta
      // attribution names this campaign. Do not materialize a form-wide route:
      // a Lead Ads form can be shared with another campaign.
      await tx
        .insert(schema.metaCampaignQueueRoutes)
        .values({
          id: randomUUID(),
          tenantId: context.tenantId,
          campaignId: campaign.campaignId,
          queueId: campaignQueueId,
          enabled: input.enabled,
          createdBy: context.userId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.metaCampaignQueueRoutes.tenantId, schema.metaCampaignQueueRoutes.campaignId],
          set: { enabled: input.enabled, updatedAt: now },
        });

      // The campaign rule covers all its ads: no per-ad copies. Pausing also
      // removes the copies an older version created ("capturar, sem fila"),
      // which kept those ads capturing after the campaign was paused. An ad
      // sent on purpose to a specific queue, or marked "não registrar", stays.
      if (!input.enabled) {
        const campaignAdIds = tx
          .select({ adId: schema.metaAds.adId })
          .from(schema.metaAds)
          .innerJoin(schema.metaAdSets, and(
            eq(schema.metaAds.tenantId, schema.metaAdSets.tenantId),
            eq(schema.metaAds.adSetId, schema.metaAdSets.adSetId),
          ))
          .where(and(
            eq(schema.metaAds.tenantId, context.tenantId),
            eq(schema.metaAdSets.campaignId, campaign.campaignId),
          ));
        await tx.delete(schema.metaAdQueueRoutes).where(and(
          eq(schema.metaAdQueueRoutes.tenantId, context.tenantId),
          eq(schema.metaAdQueueRoutes.enabled, true),
          isNull(schema.metaAdQueueRoutes.queueId),
          inArray(schema.metaAdQueueRoutes.adId, campaignAdIds),
        ));
      }

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "meta_campaign_queue_route",
        entidadeId: campaign.campaignId,
        acao: input.enabled ? "meta_campaign.capture_enabled" : "meta_campaign.capture_disabled",
      });
    });

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/marketing/campanhas", "layout");
    revalidatePath("/leads/distribuicao");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível atualizar a elegibilidade da campanha." };
  }
}

/** Definir modo mestre global de captura Meta (all | selective | disabled) */
export async function setMetaGlobalCaptureModeAction(input: {
  mode: "all" | "selective" | "disabled";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    const { setSystemSetting } = await import("@/features/system-settings/queries");
    await setSystemSetting(`meta_lead_capture_mode_${context.tenantId}`, input.mode);
    const db = getDatabase();
    await db.insert(schema.auditLogs).values({
      id: randomUUID(), userId: context.userId, entidade: "meta_capture", entidadeId: context.tenantId,
      acao: `meta_capture.global_mode:${input.mode}`, createdAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao alterar modo de captura mestre." };
  }
}

/** Alternar elegibilidade de captura de um anúncio (Ad) */
export async function toggleMetaAdCaptureEligibilityAction(input: {
  adId: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (input.enabled) {
      await ensureCaptureModeActiveIfDisabled(context.tenantId);
    }
    const db = getDatabase();
    const now = new Date();
    await db
      .insert(schema.metaAdQueueRoutes)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        adId: input.adId,
        queueId: null,
        enabled: input.enabled,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.metaAdQueueRoutes.tenantId, schema.metaAdQueueRoutes.adId],
        set: { enabled: input.enabled, updatedAt: now },
      });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao atualizar anúncio." };
  }
}

/** Alternar elegibilidade de captura de um formulário (Form) */
export async function toggleMetaFormCaptureEligibilityAction(input: {
  formId: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const context = await getRequiredTenantContext();
    if (input.enabled) {
      await ensureCaptureModeActiveIfDisabled(context.tenantId);
    }
    const db = getDatabase();
    const now = new Date();
    await db
      .insert(schema.metaFormQueueRoutes)
      .values({
        id: randomUUID(),
        tenantId: context.tenantId,
        formId: input.formId,
        queueId: null,
        enabled: input.enabled,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.metaFormQueueRoutes.tenantId, schema.metaFormQueueRoutes.formId],
        set: { enabled: input.enabled, updatedAt: now },
      });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao atualizar formulário." };
  }
}

/** Atualização em lote (batch) de elegibilidade para múltiplos ativos */
export async function batchSetMetaCaptureEligibilityAction(input: {
  assetType: "campaigns" | "ads" | "forms";
  assetIds: string[];
  enabled: boolean;
}): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    if (!input.assetIds.length) return { success: true, count: 0 };
    const context = await getRequiredTenantContext();
    if (input.enabled) {
      await ensureCaptureModeActiveIfDisabled(context.tenantId);
    }
    const db = getDatabase();
    const now = new Date();

    if (input.assetType === "campaigns") {
      const campaigns = await db.select({ id: schema.metaCampaigns.id, campaignId: schema.metaCampaigns.campaignId })
        .from(schema.metaCampaigns)
        .where(and(
          eq(schema.metaCampaigns.tenantId, context.tenantId),
          or(inArray(schema.metaCampaigns.id, input.assetIds), inArray(schema.metaCampaigns.campaignId, input.assetIds)),
        ));
      const campaignIdsByInput = new Map<string, string>();
      for (const campaign of campaigns) {
        campaignIdsByInput.set(campaign.id, campaign.campaignId);
        campaignIdsByInput.set(campaign.campaignId, campaign.campaignId);
      }
      const canonicalCampaignIds = [...new Set(input.assetIds.map((id) => campaignIdsByInput.get(id)).filter((id): id is string => Boolean(id)))];
      if (canonicalCampaignIds.length !== new Set(input.assetIds).size) {
        return { success: false, error: "Uma ou mais campanhas não pertencem à sua empresa." };
      }
      const records = canonicalCampaignIds.map((campaignId) => ({
        id: randomUUID(),
        tenantId: context.tenantId,
        campaignId,
        queueId: null,
        enabled: input.enabled,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      }));
      await db
        .insert(schema.metaCampaignQueueRoutes)
        .values(records)
        .onConflictDoUpdate({
          target: [schema.metaCampaignQueueRoutes.tenantId, schema.metaCampaignQueueRoutes.campaignId],
          set: { enabled: input.enabled, updatedAt: now },
        });
    } else if (input.assetType === "ads") {
      const records = input.assetIds.map((id) => ({
        id: randomUUID(),
        tenantId: context.tenantId,
        adId: id,
        queueId: null,
        enabled: input.enabled,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      }));
      await db
        .insert(schema.metaAdQueueRoutes)
        .values(records)
        .onConflictDoUpdate({
          target: [schema.metaAdQueueRoutes.tenantId, schema.metaAdQueueRoutes.adId],
          set: { enabled: input.enabled, updatedAt: now },
        });
    } else if (input.assetType === "forms") {
      const records = input.assetIds.map((id) => ({
        id: randomUUID(),
        tenantId: context.tenantId,
        formId: id,
        queueId: null,
        enabled: input.enabled,
        createdBy: context.userId,
        createdAt: now,
        updatedAt: now,
      }));
      await db
        .insert(schema.metaFormQueueRoutes)
        .values(records)
        .onConflictDoUpdate({
          target: [schema.metaFormQueueRoutes.tenantId, schema.metaFormQueueRoutes.formId],
          set: { enabled: input.enabled, updatedAt: now },
        });
    }

    return { success: true, count: input.assetIds.length };
  } catch (error) {
    console.error("[batchSetMetaCaptureEligibilityAction] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro na atualização em lote." };
  }
}
