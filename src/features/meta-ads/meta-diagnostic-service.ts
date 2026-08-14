import "server-only";

import { and, count, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { MetaGraphClient } from "./meta-graph-client";
import { decryptMetaToken } from "./meta-oauth";
import type { MetaSyncAuditDiagnostic } from "./types";

export async function getMetaSyncAuditDiagnostic(tenantId: string): Promise<MetaSyncAuditDiagnostic> {
  const db = getDatabase();

  const [connection] = await db
    .select()
    .from(schema.metaConnections)
    .where(and(eq(schema.metaConnections.tenantId, tenantId), eq(schema.metaConnections.status, "connected")))
    .limit(1);

  if (!connection) {
    return {
      connection: null,
      adAccounts: [],
      pages: [],
      totals: {
        metaCampaignsTotal: 0,
        crmCampaignsTotal: 0,
        metaAdsTotal: 0,
        crmAdsTotal: 0,
        metaFormsTotal: 0,
        crmFormsTotal: 0,
        crmPixelsTotal: 0,
        crmDatasetsTotal: 0,
      },
    };
  }

  const rawToken = decryptMetaToken(connection.accessTokenCiphertext);
  const client = new MetaGraphClient(rawToken);

  let grantedPermissions: string[] = [];
  try {
    grantedPermissions = await client.fetchGrantedPermissions();
  } catch {
    grantedPermissions = (connection.permissions as string[]) || [];
  }

  const adsRead = grantedPermissions.includes("ads_read") || grantedPermissions.includes("ads_management");
  const leadsRetrieval = grantedPermissions.includes("leads_retrieval");
  const pagesShowList = grantedPermissions.includes("pages_show_list");
  const pagesManageMetadata = grantedPermissions.includes("pages_manage_metadata");

  const dbAdAccounts = await db
    .select()
    .from(schema.metaAdAccounts)
    .where(eq(schema.metaAdAccounts.tenantId, tenantId));

  const dbPages = await db
    .select()
    .from(schema.metaPages)
    .where(eq(schema.metaPages.tenantId, tenantId));

  const [crmCampaignsCountRes] = await db
    .select({ total: count() })
    .from(schema.metaCampaigns)
    .where(eq(schema.metaCampaigns.tenantId, tenantId));

  const [crmAdsCountRes] = await db
    .select({ total: count() })
    .from(schema.metaAds)
    .where(eq(schema.metaAds.tenantId, tenantId));

  const [crmLeadFormsCountRes] = await db
    .select({ total: count() })
    .from(schema.metaLeadForms)
    .where(eq(schema.metaLeadForms.tenantId, tenantId));

  const [crmPixelsCountRes] = await db
    .select({ total: count() })
    .from(schema.metaPixels)
    .where(eq(schema.metaPixels.tenantId, tenantId));

  const [crmDatasetsCountRes] = await db
    .select({ total: count() })
    .from(schema.metaDatasets)
    .where(eq(schema.metaDatasets.tenantId, tenantId));

  const adAccountDiagnostics: MetaSyncAuditDiagnostic["adAccounts"] = [];
  let metaCampaignsTotal = 0;
  let metaAdsTotal = 0;

  for (const account of dbAdAccounts) {
    let metaCampaigns: Array<{ id: string; name: string }> = [];
    let metaAdsCount = 0;
    let errorMessage: string | undefined;
    let syncStatus: MetaSyncAuditDiagnostic["adAccounts"][number]["syncStatus"] = "MATCH";

    const [crmCampForAcc] = await db
      .select({ total: count() })
      .from(schema.metaCampaigns)
      .where(and(eq(schema.metaCampaigns.tenantId, tenantId), eq(schema.metaCampaigns.adAccountId, account.adAccountId)));

    const crmCount = crmCampForAcc?.total ?? 0;

    const crmAdsForAcc = await db
      .select({ total: count() })
      .from(schema.metaAds)
      .innerJoin(schema.metaAdSets, eq(schema.metaAds.adSetId, schema.metaAdSets.adSetId))
      .innerJoin(schema.metaCampaigns, eq(schema.metaAdSets.campaignId, schema.metaCampaigns.campaignId))
      .where(and(eq(schema.metaAds.tenantId, tenantId), eq(schema.metaCampaigns.adAccountId, account.adAccountId)));

    const crmAdsCount = crmAdsForAcc[0]?.total ?? 0;

    if (adsRead) {
      try {
        metaCampaigns = await client.fetchCampaigns(account.adAccountId);
        metaCampaignsTotal += metaCampaigns.length;

        for (const camp of metaCampaigns.slice(0, 15)) {
          const adSets = await client.fetchAdSets(camp.id).catch(() => []);
          for (const adSet of adSets) {
            const ads = await client.fetchAds(adSet.id).catch(() => []);
            metaAdsCount += ads.length;
          }
        }
        metaAdsTotal += metaAdsCount;

        if (metaCampaigns.length !== crmCount) {
          syncStatus = "TRUNCATED";
        }
      } catch (err) {
        syncStatus = "ERROR";
        errorMessage = err instanceof Error ? err.message : "Erro na Graph API da Meta ao consultar campanhas.";
      }
    } else {
      syncStatus = "NOT_SYNCED";
      errorMessage = "Permissão ads_read ausente no token.";
    }

    adAccountDiagnostics.push({
      adAccountId: account.adAccountId,
      name: account.name,
      status: account.status,
      metaCampaignsCount: metaCampaigns.length,
      crmCampaignsCount: crmCount,
      metaAdsCount,
      crmAdsCount,
      syncStatus,
      errorMessage,
    });
  }

  const pageDiagnostics: MetaSyncAuditDiagnostic["pages"] = [];
  let metaFormsTotal = 0;

  for (const page of dbPages) {
    let metaForms: Array<{ id: string; name: string }> = [];
    let errorMessage: string | undefined;
    let syncStatus: MetaSyncAuditDiagnostic["pages"][number]["syncStatus"] = "MATCH";
    let leadgenSubscribed = false;

    const pageToken = page.accessTokenCiphertext ? decryptMetaToken(page.accessTokenCiphertext) : rawToken;
    const hasPageToken = Boolean(page.accessTokenCiphertext);

    const [crmFormsForPage] = await db
      .select({ total: count() })
      .from(schema.metaLeadForms)
      .where(and(eq(schema.metaLeadForms.tenantId, tenantId), eq(schema.metaLeadForms.pageId, page.pageId)));

    const crmCount = crmFormsForPage?.total ?? 0;

    try {
      const pageClient = new MetaGraphClient(pageToken);
      [metaForms, leadgenSubscribed] = await Promise.all([
        pageClient.fetchLeadForms(page.pageId),
        pageClient.fetchLeadgenSubscription(page.pageId),
      ]);
      metaFormsTotal += metaForms.length;

      if (!leadgenSubscribed) {
        syncStatus = "NOT_SUBSCRIBED";
        errorMessage = "O app Corretop API Oficial não está inscrito em leadgen nesta Página.";
      } else if (metaForms.length === 0) {
        syncStatus = "EMPTY";
      } else if (metaForms.length !== crmCount) {
        syncStatus = "ERROR";
        errorMessage = "A quantidade de formulários na Meta diverge do espelho local. Execute uma nova sincronização.";
      }
    } catch {
      try {
        [metaForms, leadgenSubscribed] = await Promise.all([
          client.fetchLeadForms(page.pageId),
          client.fetchLeadgenSubscription(page.pageId),
        ]);
        metaFormsTotal += metaForms.length;
        if (!leadgenSubscribed) {
          syncStatus = "NOT_SUBSCRIBED";
          errorMessage = "O app Corretop API Oficial não está inscrito em leadgen nesta Página.";
        } else if (metaForms.length === 0) {
          syncStatus = "EMPTY";
        } else if (metaForms.length !== crmCount) {
          syncStatus = "ERROR";
          errorMessage = "A quantidade de formulários na Meta diverge do espelho local. Execute uma nova sincronização.";
        }
      } catch (fallbackErr) {
        syncStatus = "ERROR";
        errorMessage = fallbackErr instanceof Error ? fallbackErr.message : "Erro na Graph API ao consultar formulários da página.";
      }
    }

    pageDiagnostics.push({
      pageId: page.pageId,
      name: page.name,
      status: page.status,
      hasPageToken,
      leadgenSubscribed,
      metaLeadFormsCount: metaForms.length,
      crmLeadFormsCount: crmCount,
      syncStatus,
      errorMessage,
    });
  }

  return {
    connection: {
      status: connection.status,
      businessId: connection.businessId,
      businessName: connection.businessName,
      lastSyncedAt: connection.lastSyncedAt,
      permissions: grantedPermissions,
      grantedScopesCheck: {
        adsRead,
        leadsRetrieval,
        pagesShowList,
        pagesManageMetadata,
      },
    },
    adAccounts: adAccountDiagnostics,
    pages: pageDiagnostics,
    totals: {
      metaCampaignsTotal,
      crmCampaignsTotal: crmCampaignsCountRes?.total ?? 0,
      metaAdsTotal,
      crmAdsTotal: crmAdsCountRes?.total ?? 0,
      metaFormsTotal,
      crmFormsTotal: crmLeadFormsCountRes?.total ?? 0,
      crmPixelsTotal: crmPixelsCountRes?.total ?? 0,
      crmDatasetsTotal: crmDatasetsCountRes?.total ?? 0,
    },
  };
}
