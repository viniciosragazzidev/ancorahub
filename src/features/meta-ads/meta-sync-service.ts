import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { MetaGraphClient } from "./meta-graph-client";
import { decryptMetaToken } from "./meta-oauth";

export async function runMetaTenantSync(tenantId: string, syncType: "full" | "campaigns" | "forms" = "full"): Promise<{
  success: boolean;
  itemsSynced: number;
  error?: string;
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
    // 1. Buscar conexão Meta ativa para o tenant
    const [connection] = await db
      .select()
      .from(schema.metaConnections)
      .where(and(eq(schema.metaConnections.tenantId, tenantId), eq(schema.metaConnections.status, "connected")))
      .limit(1);

    if (!connection) {
      const errorMsg = "Nenhuma conexão Meta ativa encontrada para este tenant.";
      await db
        .update(schema.metaSyncLogs)
        .set({ status: "error", errorDetails: errorMsg, durationMs: Date.now() - startTime, completedAt: new Date() })
        .where(eq(schema.metaSyncLogs.id, syncLogId));
      return { success: false, itemsSynced: 0, error: errorMsg };
    }

    const rawToken = decryptMetaToken(connection.accessTokenCiphertext);
    const client = new MetaGraphClient(rawToken);

    let totalSynced = 0;

    // 2. Buscar contas de anúncios do tenant
    const adAccounts = await db
      .select()
      .from(schema.metaAdAccounts)
      .where(and(eq(schema.metaAdAccounts.tenantId, tenantId), eq(schema.metaAdAccounts.status, "active")));

    for (const account of adAccounts) {
      const remoteCampaigns = await client.fetchCampaigns(account.adAccountId);

      for (const campaign of remoteCampaigns) {
        const campaignUuid = randomUUID();
        const now = new Date();

        await db
          .insert(schema.metaCampaigns)
          .values({
            id: campaignUuid,
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
          })
          .onConflictDoUpdate({
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

        // Buscar conjuntos e anúncios para cada campanha
        const adSets = await client.fetchAdSets(campaign.id);
        for (const adSet of adSets) {
          await db
            .insert(schema.metaAdSets)
            .values({
              id: randomUUID(),
              tenantId,
              campaignId: campaign.id,
              adSetId: adSet.id,
              name: adSet.name,
              status: adSet.status || "PAUSED",
              targeting: adSet.targeting || null,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [schema.metaAdSets.tenantId, schema.metaAdSets.adSetId],
              set: { name: adSet.name, status: adSet.status || "PAUSED", updatedAt: now },
            });

          const ads = await client.fetchAds(adSet.id);
          for (const ad of ads) {
            await db
              .insert(schema.metaAds)
              .values({
                id: randomUUID(),
                tenantId,
                adSetId: adSet.id,
                adId: ad.id,
                name: ad.name,
                status: ad.status || "PAUSED",
                createdAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: [schema.metaAds.tenantId, schema.metaAds.adId],
                set: { name: ad.name, status: ad.status || "PAUSED", updatedAt: now },
              });
          }
        }
      }

      const pixels = await client.fetchPixels(account.adAccountId);
      for (const pixel of pixels) {
        await db.insert(schema.metaPixels).values({
          id: randomUUID(), tenantId, pixelId: pixel.id, name: pixel.name, status: "active", createdAt: new Date(), updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [schema.metaPixels.tenantId, schema.metaPixels.pixelId],
          set: { name: pixel.name, status: "active", updatedAt: new Date() },
        });
        totalSynced++;
      }
    }

    const datasets = await client.fetchDatasets(connection.businessId);
    for (const dataset of datasets) {
      await db.insert(schema.metaDatasets).values({
        id: randomUUID(), tenantId, datasetId: dataset.id, name: dataset.name, status: "active", createdAt: new Date(), updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: [schema.metaDatasets.tenantId, schema.metaDatasets.datasetId],
        set: { name: dataset.name, status: "active", updatedAt: new Date() },
      });
      totalSynced++;
    }

    // 3. Buscar formulários de Lead Ads de cada página do tenant
    const pages = await db.select().from(schema.metaPages)
      .where(and(eq(schema.metaPages.tenantId, tenantId), eq(schema.metaPages.status, "active")));
    for (const page of pages) {
      const pageToken = page.accessTokenCiphertext ? decryptMetaToken(page.accessTokenCiphertext) : rawToken;
      const forms = await new MetaGraphClient(pageToken).fetchLeadForms(page.pageId);
      for (const form of forms) {
        await db
          .insert(schema.metaLeadForms)
          .values({
            id: randomUUID(),
            tenantId,
            pageId: page.pageId,
            formId: form.id,
            name: form.name,
            status: form.status || "ACTIVE",
            locale: form.locale || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [schema.metaLeadForms.tenantId, schema.metaLeadForms.formId],
            set: { name: form.name, status: form.status || "ACTIVE", updatedAt: new Date() },
          });
        totalSynced++;
      }
    }

    // Atualizar conexão e log de sync
    const now = new Date();
    await db.update(schema.metaConnections).set({ lastSyncedAt: now, lastError: null, updatedAt: now }).where(eq(schema.metaConnections.id, connection.id));

    await db
      .update(schema.metaSyncLogs)
      .set({
        status: "success",
        itemsSynced: totalSynced,
        durationMs: Date.now() - startTime,
        completedAt: now,
      })
      .where(eq(schema.metaSyncLogs.id, syncLogId));

    return { success: true, itemsSynced: totalSynced };
  } catch (err: any) {
    const errorDetails = err?.message || "Erro desconhecido durante a sincronização Meta.";
    await db
      .update(schema.metaSyncLogs)
      .set({
        status: "error",
        errorDetails,
        durationMs: Date.now() - startTime,
        completedAt: new Date(),
      })
      .where(eq(schema.metaSyncLogs.id, syncLogId));

    return { success: false, itemsSynced: 0, error: errorDetails };
  }
}
