"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { decryptMetaToken, encryptMetaToken } from "./meta-oauth";
import { consumeMetaConnectionAttempt, readVerifiedMetaConnectionAttempt } from "./meta-connection-attempts";
import { startMetaMarketingConnection } from "./meta-marketing-connection-service";
import { MetaGraphClient } from "./meta-graph-client";
import { runMetaTenantSync } from "./meta-sync-service";
import { configureMetaLeadAdsSource } from "@/features/communication-channels/meta-lead-ads";
import { resolvePageAccessToken, subscribePageToLeadgen } from "@/features/communication-channels/meta-cloud-client";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaDiscoveredAssets, MetaSyncLogItem } from "./types";

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

  const [pages, adAccounts, pixels, datasets, leadForms, campaigns, ads, logs] = await Promise.all([
    db.select({ id: schema.metaPages.pageId, name: schema.metaPages.name, status: schema.metaPages.status }).from(schema.metaPages).where(eq(schema.metaPages.tenantId, context.tenantId)).orderBy(schema.metaPages.name),
    db.select({ id: schema.metaAdAccounts.adAccountId, name: schema.metaAdAccounts.name, currency: schema.metaAdAccounts.currency, status: schema.metaAdAccounts.status }).from(schema.metaAdAccounts).where(eq(schema.metaAdAccounts.tenantId, context.tenantId)).orderBy(schema.metaAdAccounts.name),
    db.select({ id: schema.metaPixels.pixelId, name: schema.metaPixels.name, status: schema.metaPixels.status }).from(schema.metaPixels).where(eq(schema.metaPixels.tenantId, context.tenantId)).orderBy(schema.metaPixels.name),
    db.select({ id: schema.metaDatasets.datasetId, name: schema.metaDatasets.name, status: schema.metaDatasets.status }).from(schema.metaDatasets).where(eq(schema.metaDatasets.tenantId, context.tenantId)).orderBy(schema.metaDatasets.name),
    db.select({ id: schema.metaLeadForms.formId, name: schema.metaLeadForms.name, status: schema.metaLeadForms.status, pageId: schema.metaLeadForms.pageId }).from(schema.metaLeadForms).where(eq(schema.metaLeadForms.tenantId, context.tenantId)).orderBy(schema.metaLeadForms.name),
    db.select({ id: schema.metaCampaigns.campaignId, name: schema.metaCampaigns.name, status: schema.metaCampaigns.status, adAccountId: schema.metaCampaigns.adAccountId }).from(schema.metaCampaigns).where(eq(schema.metaCampaigns.tenantId, context.tenantId)).orderBy(schema.metaCampaigns.name),
    db.select({ id: schema.metaAds.adId, name: schema.metaAds.name, status: schema.metaAds.status, adSetId: schema.metaAds.adSetId }).from(schema.metaAds).where(eq(schema.metaAds.tenantId, context.tenantId)).orderBy(schema.metaAds.name),
    db.select().from(schema.metaSyncLogs).where(eq(schema.metaSyncLogs.tenantId, context.tenantId)).orderBy(desc(schema.metaSyncLogs.startedAt)).limit(10),
  ]);

  const assets: MetaConnectionAssets = { pages, adAccounts, pixels, datasets, leadForms, campaigns, ads };

  const connInfo: MetaConnectionInfo = {
    id: connection.id,
    tenantId: connection.tenantId,
    businessId: connection.businessId,
    businessName: connection.businessName,
    status: connection.status as any,
    permissions: (connection.permissions as string[]) || [],
    expiresAt: connection.expiresAt,
    lastError: connection.lastError,
    lastSyncedAt: connection.lastSyncedAt,
    pagesCount: pages.length,
    adAccountsCount: adAccounts.length,
    whatsappConnected: false,
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
      createdBy: context.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  const activeConnectionId = existing?.id || connectionId;

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

  revalidatePath("/integrations/meta");
  revalidatePath("/settings/integracoes/meta");
  revalidatePath("/marketing/campanhas");

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

  revalidatePath("/integrations/meta");
  revalidatePath("/settings/integracoes/meta");
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
export async function triggerManualMetaSync(): Promise<{ success: boolean; itemsSynced: number; error?: string }> {
  const context = await getRequiredTenantContext();
  const res = await runMetaTenantSync(context.tenantId, "full");
  revalidatePath("/integrations/meta");
  revalidatePath("/settings/integracoes/meta");
  revalidatePath("/marketing/campanhas");
  return res;
}
