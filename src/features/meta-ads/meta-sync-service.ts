import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { subscribePageToLeadgen } from "@/features/communication-channels/meta-cloud-client";

import { isMetaAdsReadPermissionError, isMetaPermissionError, isMetaRateLimitError, MetaGraphClient } from "./meta-graph-client";
import { decryptMetaToken } from "./meta-oauth";
import { isMetaAdAccountId, isMetaPageId } from "./meta-id-validation";
import type { MetaSyncWarning } from "./types";

const MISSING_ADS_READ_MESSAGE = "A conexão Meta atual não recebeu leitura da conta de anúncios. Reconecte Marketing com um administrador da conta e conceda ads_read para sincronizar campanhas, anúncios e pixels.";
const META_RATE_LIMIT_BASE_COOLDOWN_MS = 60 * 60 * 1000;
const META_RATE_LIMIT_MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const META_SCHEDULED_SYNC_MIN_INTERVAL_MS = 60 * 60 * 1000;

type MetaSyncOptions = { scheduled?: boolean };

function isPersistedMetaRateLimit(errorDetails: string | null) {
  return typeof errorDetails === "string"
    && /user request limit reached|request limit reached|rate.?limit/i.test(errorDetails);
}

function formatBrasiliaTime(date: Date) {
  return `${new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)} (horário de Brasília)`;
}

function uniqueWarnings(warnings: MetaSyncWarning[]) {
  return [...new Map(warnings.map((warning) => [warning.code, warning])).values()];
}

function readLeadGenFormId(creative: { object_story_spec?: unknown } | undefined): string | null {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: creative?.object_story_spec, depth: 0 }];
  while (pending.length) {
    const current = pending.pop()!;
    if (!current.value || typeof current.value !== "object" || current.depth > 8) continue;
    for (const [key, value] of Object.entries(current.value)) {
      if ((key === "lead_gen_form_id" || key === "lead_form_id") && (typeof value === "string" || typeof value === "number")) {
        return String(value);
      }
      if (value && typeof value === "object") pending.push({ value, depth: current.depth + 1 });
    }
  }
  return null;
}

function serializeSyncWarnings(warnings: MetaSyncWarning[]) {
  return warnings.length ? JSON.stringify({ warnings }) : null;
}

export async function runMetaTenantSync(
  tenantId: string,
  syncType: "full" | "campaigns" | "forms" = "full",
  options: MetaSyncOptions = {},
): Promise<{
  success: boolean;
  itemsSynced: number;
  error?: string;
  warnings?: MetaSyncWarning[];
}> {
  const db = getDatabase();
  const startTime = Date.now();
  const syncLogId = randomUUID();

  const recentLogs = await db.select({
    status: schema.metaSyncLogs.status,
    errorDetails: schema.metaSyncLogs.errorDetails,
    startedAt: schema.metaSyncLogs.startedAt,
    completedAt: schema.metaSyncLogs.completedAt,
  }).from(schema.metaSyncLogs)
    .where(eq(schema.metaSyncLogs.tenantId, tenantId))
    .orderBy(desc(schema.metaSyncLogs.startedAt))
    .limit(8);

  const consecutiveRateLimitFailures = recentLogs.reduce((count, log, index) => {
    if (index !== count || log.status !== "error" || !isPersistedMetaRateLimit(log.errorDetails)) return count;
    return count + 1;
  }, 0);
  const latestLog = recentLogs[0];
  if (consecutiveRateLimitFailures > 0 && latestLog) {
    const backoffMs = Math.min(
      META_RATE_LIMIT_MAX_COOLDOWN_MS,
      META_RATE_LIMIT_BASE_COOLDOWN_MS * (2 ** (consecutiveRateLimitFailures - 1)),
    );
    const retryAt = new Date((latestLog.completedAt ?? latestLog.startedAt).getTime() + backoffMs);
    if (retryAt.getTime() > startTime) {
      return {
        success: false,
        itemsSynced: 0,
        error: `A Meta limitou as chamadas. Para evitar novas falhas, a sincronização será liberada após ${formatBrasiliaTime(retryAt)}.`,
      };
    }
  }

  if (options.scheduled && latestLog && ["success", "partial"].includes(latestLog.status)) {
    const lastCompletedAt = latestLog.completedAt ?? latestLog.startedAt;
    const retryAt = new Date(lastCompletedAt.getTime() + META_SCHEDULED_SYNC_MIN_INTERVAL_MS);
    if (retryAt.getTime() > startTime) {
      return {
        success: false,
        itemsSynced: 0,
        error: `A sincronização automática seguinte está prevista após ${formatBrasiliaTime(retryAt)}.`,
      };
    }
  }

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
    const grantedPermissions = await client.fetchGrantedPermissions().catch((error: unknown) => {
      if (isMetaRateLimitError(error)) throw error;
      return connection.permissions as string[];
    });
    const canReadAds = grantedPermissions.includes("ads_read") || grantedPermissions.includes("ads_management");
    const now = new Date();

    await db.update(schema.metaConnections)
      .set({ permissions: grantedPermissions, updatedAt: now })
      .where(eq(schema.metaConnections.id, connection.id));

    const adAccounts = await db.select().from(schema.metaAdAccounts)
      .where(and(eq(schema.metaAdAccounts.tenantId, tenantId), eq(schema.metaAdAccounts.status, "active")));
    const activeQueueIds = new Set((await db.select({ id: schema.leadQueues.id })
      .from(schema.leadQueues)
      .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active"))))
      .map((queue) => queue.id));

    const validAdAccounts = [] as typeof adAccounts;
    for (const account of adAccounts) {
      if (isMetaAdAccountId(account.adAccountId)) {
        validAdAccounts.push(account);
        continue;
      }

      console.warn("[meta-sync] Ignoring invalid persisted ad-account identifier", {
        tenantId,
        adAccountId: account.adAccountId,
      });
      await db.update(schema.metaAdAccounts)
        .set({ status: "inactive", updatedAt: now })
        .where(and(
          eq(schema.metaAdAccounts.tenantId, tenantId),
          eq(schema.metaAdAccounts.connectionId, connection.id),
          eq(schema.metaAdAccounts.adAccountId, account.adAccountId),
          eq(schema.metaAdAccounts.status, "active"),
        ));
      warnings.push({
        code: "invalid_asset",
        message: "Uma conta de anuncios invalida foi desativada localmente. Reconecte ou selecione novamente uma conta real da Meta.",
      });
    }

    if (!canReadAds && adAccounts.length) {
      warnings.push({ code: "missing_ads_read", message: MISSING_ADS_READ_MESSAGE });
    }

    for (const account of canReadAds ? validAdAccounts : []) {
      try {
        const remoteCampaigns = await client.fetchCampaigns(account.adAccountId);
        const remoteCampaignIds = new Set(remoteCampaigns.map((campaign) => campaign.id));
        for (const campaign of remoteCampaigns) {
          const deliveryStatus = campaign.effective_status || campaign.status || "PAUSED";
          await db.insert(schema.metaCampaigns).values({
            id: randomUUID(),
            tenantId,
            adAccountId: account.adAccountId,
            campaignId: campaign.id,
            name: campaign.name,
            objective: campaign.objective || null,
            status: deliveryStatus,
            dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget, 10) : null,
            lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget, 10) : null,
            startTime: campaign.start_time ? new Date(campaign.start_time) : null,
            stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: [schema.metaCampaigns.tenantId, schema.metaCampaigns.campaignId],
            set: {
              adAccountId: account.adAccountId,
              name: campaign.name,
              objective: campaign.objective || null,
              status: deliveryStatus,
              dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget, 10) : null,
              lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget, 10) : null,
              updatedAt: now,
            },
          });
          if (account.defaultQueueId && activeQueueIds.has(account.defaultQueueId)) {
            await db.insert(schema.metaCampaignQueueRoutes).values({
              id: randomUUID(),
              tenantId,
              campaignId: campaign.id,
              queueId: account.defaultQueueId,
              enabled: true,
              createdAt: now,
              updatedAt: now,
            }).onConflictDoNothing();
          }
          totalSynced++;
        }

        const adSetIds = new Set<string>();
        try {
          const adSets = await client.fetchAdSetsForAccount(account.adAccountId);
          for (const adSet of adSets) {
            const campaignId = adSet.campaign_id;
            if (!campaignId || !remoteCampaignIds.has(campaignId)) continue;
            adSetIds.add(adSet.id);
            await db.insert(schema.metaAdSets).values({
              id: randomUUID(), tenantId, campaignId, adSetId: adSet.id,
              name: adSet.name, status: adSet.status || "PAUSED", targeting: adSet.targeting || null,
              createdAt: now, updatedAt: now,
            }).onConflictDoUpdate({
              target: [schema.metaAdSets.tenantId, schema.metaAdSets.adSetId],
              set: { campaignId, name: adSet.name, status: adSet.status || "PAUSED", targeting: adSet.targeting || null, updatedAt: now },
            });
          }
        } catch (adSetError) {
          if (isMetaRateLimitError(adSetError)) throw adSetError;
          console.error(`[meta-sync] Warning fetching adSets for account ${account.adAccountId}:`, adSetError);
          warnings.push({
            code: "asset_access_limited",
            message: `Não foi possível sincronizar os conjuntos de anúncios da conta ${account.name || account.adAccountId}. ${adSetError instanceof Error ? adSetError.message : "Erro na API da Meta."}`,
          });
        }

        if (adSetIds.size) {
          try {
            const ads = await client.fetchAdsForAccount(account.adAccountId);
            for (const ad of ads) {
              if (!ad.adset_id || !adSetIds.has(ad.adset_id)) continue;
              const leadGenFormId = readLeadGenFormId(ad.creative);
              await db.insert(schema.metaAds).values({
                id: randomUUID(), tenantId, adSetId: ad.adset_id, adId: ad.id, leadGenFormId,
                name: ad.name, status: ad.status || "PAUSED", createdAt: now, updatedAt: now,
              }).onConflictDoUpdate({
                target: [schema.metaAds.tenantId, schema.metaAds.adId],
                set: { adSetId: ad.adset_id, ...(leadGenFormId ? { leadGenFormId } : {}), name: ad.name, status: ad.status || "PAUSED", updatedAt: now },
              });
            }
          } catch (adError) {
            if (isMetaRateLimitError(adError)) throw adError;
            console.error(`[meta-sync] Warning fetching ads for account ${account.adAccountId}:`, adError);
            warnings.push({
              code: "asset_access_limited",
              message: `Não foi possível sincronizar os anúncios da conta ${account.name || account.adAccountId}. ${adError instanceof Error ? adError.message : "Erro na API da Meta."}`,
            });
          }
        }

        try {
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
        } catch (pixelError) {
          if (isMetaRateLimitError(pixelError)) throw pixelError;
          console.error(`[meta-sync] Warning fetching pixels for account ${account.adAccountId}:`, pixelError);
        }
      } catch (error) {
        if (isMetaRateLimitError(error)) throw error;
        console.error(`[meta-sync] Error syncing ad account ${account.adAccountId}:`, error);
        if (isMetaAdsReadPermissionError(error)) {
          warnings.push({ code: "missing_ads_read", message: MISSING_ADS_READ_MESSAGE });
        } else {
          warnings.push({
            code: "asset_access_limited",
            message: `Erro ao sincronizar a conta de anúncios ${account.name || account.adAccountId}: ${error instanceof Error ? error.message : "Erro na API da Meta."}`,
          });
        }
        continue;
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
      if (isMetaRateLimitError(error)) throw error;
      if (isMetaPermissionError(error)) {
        warnings.push({ code: "asset_access_limited", message: "A Meta não liberou fontes de dados para esta conexão. O administrador precisa conceder acesso a esse ativo no Business Manager." });
      } else {
        console.error("[meta-sync] Warning fetching datasets:", error);
      }
    }

    const pages = await db.select().from(schema.metaPages)
      .where(and(eq(schema.metaPages.tenantId, tenantId), eq(schema.metaPages.status, "active")));
    const validPages = [] as typeof pages;
    for (const page of pages) {
      if (isMetaPageId(page.pageId)) {
        validPages.push(page);
        continue;
      }

      console.warn("[meta-sync] Ignoring invalid persisted page identifier", {
        tenantId,
        pageId: page.pageId,
      });
      await db.update(schema.metaPages)
        .set({ status: "inactive", updatedAt: now })
        .where(and(
          eq(schema.metaPages.tenantId, tenantId),
          eq(schema.metaPages.connectionId, connection.id),
          eq(schema.metaPages.pageId, page.pageId),
          eq(schema.metaPages.status, "active"),
        ));
      warnings.push({
        code: "invalid_asset",
        message: "Uma pagina Meta invalida foi desativada localmente. Reconecte ou selecione novamente uma pagina real da Meta.",
      });
    }

    for (const page of validPages) {
      try {
        const pageToken = page.accessTokenCiphertext ? decryptMetaToken(page.accessTokenCiphertext) : rawToken;
        const pageLeadgenClient = new MetaGraphClient(pageToken);
        const leadgenSubscribed = await pageLeadgenClient.fetchLeadgenSubscription(page.pageId);
        if (!leadgenSubscribed) {
          await subscribePageToLeadgen(page.pageId, pageToken);
          console.log("[meta-sync] Repaired missing leadgen subscription", { tenantId, pageId: page.pageId });
        }
        let forms: Array<{ id: string; name: string; status?: string; locale?: string }> = [];

        // Try with Page Token first, fallback to User Token
        try {
          forms = await new MetaGraphClient(pageToken).fetchLeadForms(page.pageId);
        } catch (pageTokenError) {
          if (isMetaRateLimitError(pageTokenError)) throw pageTokenError;
          if (pageToken !== rawToken) {
            forms = await client.fetchLeadForms(page.pageId);
          } else {
            throw pageTokenError;
          }
        }

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
        if (isMetaRateLimitError(error)) throw error;
        console.error(`[meta-sync] Error fetching lead forms for page ${page.pageId}:`, error);
        if (error instanceof Error && error.message.includes("leadgen")) {
          const message = "The Page leadgen subscription is not confirmed. The source remains active, but new leads may wait for Meta delivery to be repaired.";
          warnings.push({ code: "leadgen_subscription_missing", message });
          await db.update(schema.metaLeadAdSources)
            .set({ lastError: message, updatedAt: now })
            .where(and(
              eq(schema.metaLeadAdSources.tenantId, tenantId),
              eq(schema.metaLeadAdSources.pageId, page.pageId),
              eq(schema.metaLeadAdSources.status, "active"),
            ));
        }
        if (isMetaPermissionError(error)) {
          warnings.push({
            code: "asset_access_limited",
            message: `A Meta não liberou os formulários da página ${page.name}. Confirme acesso à página e a permissão leads_retrieval.`,
          });
        }
        continue;
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
    if (isMetaRateLimitError(error)) {
      console.warn(`[meta-sync] Meta rate limit (code ${error.code}); aborting tenant ${tenantId} sync.`);
    }
    const errorDetails = error instanceof Error ? error.message : "Erro desconhecido durante a sincronização Meta.";
    await db.update(schema.metaSyncLogs).set({
      status: "error", errorDetails, durationMs: Date.now() - startTime, completedAt: new Date(),
    }).where(eq(schema.metaSyncLogs.id, syncLogId));
    return { success: false, itemsSynced: 0, error: errorDetails };
  }
}
