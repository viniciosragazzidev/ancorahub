import "server-only";

import { and, eq } from "drizzle-orm";

import { readAdCreative, scheduleAdCreativeRefresh, shouldRefreshAdCreative } from "@/features/meta-ads/ad-creative-cache";
import { getDatabase, schema } from "@/shared/db";

import { brokerAdKeys, buildBrokerAdContext, type BrokerAdContext } from "./broker-ad-context";
import { isBrokerAdContextEnabled } from "./broker-ad-context-flag";

type LeadForAdContext = Parameters<typeof brokerAdKeys>[0];

export async function readCampaignBrokerOffer(tenantId: string, campaignId: string | null) {
  if (!campaignId) return null;
  const [row] = await getDatabase()
    .select({ offer: schema.metaCampaignBrokerBriefs.offer })
    .from(schema.metaCampaignBrokerBriefs)
    .where(and(eq(schema.metaCampaignBrokerBriefs.tenantId, tenantId), eq(schema.metaCampaignBrokerBriefs.campaignId, campaignId)))
    .limit(1);
  return row?.offer ?? null;
}

/**
 * Cartão "De onde veio" do corretor. O lead já passou pela consulta autorizada
 * da página (escopo do corretor ou oferta pendente para ele): aqui só se lê o
 * anúncio desse lead, no tenant do contexto. Imagem velha ou criativo ainda não
 * lido: mostra o que houver e renova em segundo plano.
 */
export async function loadBrokerAdContext(tenantId: string, lead: LeadForAdContext): Promise<BrokerAdContext | null> {
  if (!(await isBrokerAdContextEnabled(tenantId))) return null;
  const { adId, campaignId } = brokerAdKeys(lead);
  try {
    const [creative, offer] = await Promise.all([
      adId ? readAdCreative(tenantId, adId) : Promise.resolve(null),
      readCampaignBrokerOffer(tenantId, campaignId),
    ]);
    if (adId && shouldRefreshAdCreative(creative)) scheduleAdCreativeRefresh(tenantId, adId);
    return buildBrokerAdContext({ lead, creative, offer });
  } catch (error) {
    // Tabelas ainda sem migração ou banco lento: a tela do lead abre sem o cartão.
    console.warn("[broker-ad-context] load.failed", { tenantId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
