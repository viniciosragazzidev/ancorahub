import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { isMetaAdsReadPermissionError, isMetaPermissionError, MetaGraphClient } from "./meta-graph-client";
import { decryptMetaToken } from "./meta-oauth";
import type { MetaSyncWarning } from "./types";

const MISSING_ADS_READ_MESSAGE = "A conexão Meta atual não recebeu leitura da conta de anúncios. Reconecte Marketing com um administrador da conta e conceda ads_read para sincronizar campanhas, anúncios e pixels.";

function uniqueWarnings(warnings: MetaSyncWarning[]) {
  return [...new Map(warnings.map((warning) => [warning.code, warning])).values()];
}

function serializeSyncWarnings(warnings: MetaSyncWarning[]) {
  return warnings.length ? JSON.stringify({ warnings }) : null;
}

export async function runMetaTenantSync(tenantId: string, syncType: "full" | "campaigns" | "forms" = "full"): Promise<{
  success: boolean;
  itemsSynced: number;
  error?: string;
  warnings?: MetaSyncWarning[];
}> {
  const db = getDatabase();
  const startTime = Date.now();
  const syncLogId = randomUUID();

  await db.insert(schema.metaSyncLogs).values({
    id: syncLogId,
    tenantId,
    syncType,
    status: "in_progress",
    itemsSynced: 0,
    startedAt: new Date(),
  });

  try {
    const [connection] = await db
      .select()
      .from(schema.metaConnections)
      .where(and(eq(schema.metaConnections.tenantId, tenantId), eq(schema.metaConnections.status, "connected")))
      .limit(1);

    if (!connection) {
      const error = "Nenhuma conexão Meta ativa encontrada para este tenant.";
      await db.update(schema.metaSyncLogs)
        .set({ status: "error", errorDetails: error, durationMs: Date.now() - startTime, completedAt: new Date() })
        .where(eq(schema.metaSyncLogs.id, syncLogId));
      return { success: false, itemsSynced: 0, error };
    }

    const rawToken = decryptMetaToken(connection.accessTokenCiphertext);
    const client = new MetaGraphClient(rawToken);
    const warnings: MetaSyncWarning[] = [];
    let totalSynced = 0;

    // Permission data stored by older connections can be empty. Refresh the
    // server-side grant without returning or logging the token.
    const grantedPermissions = await client.fetchGrantedPermissions().catch(() => connection.permissions as string[]);
    const canReadAds = grantedPermissions.includes("ads_read") || grantedPermissions.includes("ads_management");
    const now = new Date();

    await db.update(schema.metaConnections)
      .set({ permissions: grantedPermissions, updatedAt: now })
      .where(eq(schema.metaConnections.id, connection.id));

    const adAccounts = await db.select().from(schema.metaAdAccounts)
      .where(and(eq(schema.metaAdAccounts.tenantId, tenantId), eq(schema.metaAdAccounts.status, "active")));

    if (!canReadAds && adAccounts.length) {
      warnings.push({ code: "missing_ads_read", message: MISSING_ADS_READ_MESSAGE });
    }

    for (const account of canReadAds ? adAccounts : []) {
      try {
        const remoteCampaigns = await client.fetchCampaigns(account.adAccountId);
        for (const campaign of remoteCampaigns) {
          await db.insert(schema.metaCampaigns).values({
            id: randomUUID(),
            tenantId,
            adAccountId: account.adAccountId,
            campaignId: campaign.id,
            name: campaign.name,
            objective: campaign.objective || null,
            status: campaign.status || "PAUSED",
            dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget, 10) : null,
            lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget, 10) : null,
            startTime: campaign.start_time ? new Date(campaign.start_time) : null,
            stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: [schema.metaCampaigns.tenantId, schema.metaCampaigns.campaignId],
            set: {
              name: campaign.name,
              objective: campaign.objective || null,
              status: campaign.status || "PAUSED",
              dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget, 10) : null,
              lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget, 10) : null,
              updatedAt: now,
            },
          });
          totalSynced++;

          const adSets = await client.fetchAdSets(campaign.id);
          for (const adSet of adSets) {
            await db.insert(schema.metaAdSets).values({
              id: randomUUID(), tenantId, campaignId: campaign.id, adSetId: adSet.id,
              name: adSet.name, status: adSet.status || "PAUSED", targeting: adSet.targeting || null,
              createdAt: now, updatedAt: now,
            }).onConflictDoUpdate({
              target: [schema.metaAdSets.tenantId, schema.metaAdSets.adSetId],
              set: { name: adSet.name, status: adSet.status || "PAUSED", updatedAt: now },
            });

            const ads = await client.fetchAds(adSet.id);
            for (const ad of ads) {
              await db.insert(schema.metaAds).values({
                id: randomUUID(), tenantId, adSetId: adSet.id, adId: ad.id,
                name: ad.name, status: ad.status || "PAUSED", createdAt: now, updatedAt: now,
              }).onConflictDoUpdate({
                target: [schema.metaAds.tenantId, schema.metaAds.adId],
                set: { name: ad.name, status: ad.status || "PAUSED", updatedAt: now },
              });
            }
          }
        }

        const pixels = await client.fetchPixels(account.adAccountId);
        for (const pixel of pixels) {
          await db.insert(schema.metaPixels).values({
            id: randomUUID(), tenantId, pixelId: pixel.id, name: pixel.name, status: "active", createdAt: now, updatedAt: now,
          }).onConflictDoUpdate({
            target: [schema.metaPixels.tenantId, schema.metaPixels.pixelId],
            set: { name: pixel.name, status: "active", updatedAt: now },
          });
          totalSynced++;
        }
      } catch (error) {
        if (isMetaAdsReadPermissionError(error)) {
          warnings.push({ code: "missing_ads_read", message: MISSING_ADS_READ_MESSAGE });
          continue;
        }
        throw error;
      }
    }

    try {
      const datasets = await client.fetchDatasets(connection.businessId);
      for (const dataset of datasets) {
        await db.insert(schema.metaDatasets).values({
          id: randomUUID(), tenantId, datasetId: dataset.id, name: dataset.name, status: "active", createdAt: now, updatedAt: now,
        }).onConflictDoUpdate({
          target: [schema.metaDatasets.tenantId, schema.metaDatasets.datasetId],
          set: { name: dataset.name, status: "active", updatedAt: now },
        });
        totalSynced++;
      }
    } catch (error) {
      if (isMetaPermissionError(error)) {
        warnings.push({ code: "asset_access_limited", message: "A Meta não liberou fontes de dados para esta conexão. O administrador precisa conceder acesso a esse ativo no Business Manager." });
      } else {
        throw error;
      }
    }

    const pages = await db.select().from(schema.metaPages)
      .where(and(eq(schema.metaPages.tenantId, tenantId), eq(schema.metaPages.status, "active")));
    for (const page of pages) {
      try {
        const pageToken = page.accessTokenCiphertext ? decryptMetaToken(page.accessTokenCiphertext) : rawToken;
        const forms = await new MetaGraphClient(pageToken).fetchLeadForms(page.pageId);
        for (const form of forms) {
          await db.insert(schema.metaLeadForms).values({
            id: randomUUID(), tenantId, pageId: page.pageId, formId: form.id, name: form.name,
            status: form.status || "ACTIVE", locale: form.locale || null, createdAt: now, updatedAt: now,
          }).onConflictDoUpdate({
            target: [schema.metaLeadForms.tenantId, schema.metaLeadForms.formId],
            set: { name: form.name, status: form.status || "ACTIVE", updatedAt: now },
          });
          totalSynced++;
        }
      } catch (error) {
        if (isMetaPermissionError(error)) {
          warnings.push({
            code: "asset_access_limited",
            message: `A Meta não liberou os formulários da página ${page.name}. Confirme acesso à página e a permissão leads_retrieval.`,
          });
          continue;
        }
        throw error;
      }
    }

    const normalizedWarnings = uniqueWarnings(warnings);
    const warningDetails = serializeSyncWarnings(normalizedWarnings);
    const completedAt = new Date();
    await db.update(schema.metaConnections)
      .set({ lastSyncedAt: completedAt, lastError: warningDetails, updatedAt: completedAt })
      .where(eq(schema.metaConnections.id, connection.id));
    await db.update(schema.metaSyncLogs).set({
      status: normalizedWarnings.length ? "partial" : "success",
      itemsSynced: totalSynced,
      errorDetails: warningDetails,
      durationMs: Date.now() - startTime,
      completedAt,
    }).where(eq(schema.metaSyncLogs.id, syncLogId));

    return { success: true, itemsSynced: totalSynced, warnings: normalizedWarnings };
  } catch (error) {
    const errorDetails = error instanceof Error ? error.message : "Erro desconhecido durante a sincronização Meta.";
    await db.update(schema.metaSyncLogs).set({
      status: "error", errorDetails, durationMs: Date.now() - startTime, completedAt: new Date(),
    }).where(eq(schema.metaSyncLogs.id, syncLogId));
    return { success: false, itemsSynced: 0, error: errorDetails };
  }
}
