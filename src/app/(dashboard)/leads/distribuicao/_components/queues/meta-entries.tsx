"use client";

/**
 * Entradas Meta (campanhas) de uma fila, ou as campanhas não registradas (`queueId` null). No visual Lite (27/11/2026):
 * linhas em pílula com o estado da captura e o atalho para a campanha; lista longa rola dentro da gaveta.
 */
import Link from "next/link";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { pl } from "../../plantao/_components/plantoes-1a1-kit";
import { Row1a1, pn } from "../panels-1a1";

export type MetaCampaign = { campaignId: string; name: string; status: string };
export type MetaAd = { adId: string; name: string; status: string; campaignId: string | null };
export type MetaCampaignRoute = { campaignId: string; queueId: string | null; queueName: string | null; enabled: boolean };
export type MetaAdRoute = { adId: string; queueId: string | null; queueName: string | null; enabled: boolean };

export type MetaEntriesData = {
  campaigns: MetaCampaign[];
  ads: MetaAd[];
  campaignRoutes: MetaCampaignRoute[];
  adRoutes: MetaAdRoute[];
};

export function countQueueEntries(data: MetaEntriesData, queueId: string) {
  const campaigns = data.campaignRoutes.filter((route) => route.enabled && route.queueId === queueId);
  const campaignIds = new Set(campaigns.map((route) => route.campaignId));
  return {
    campaigns: campaigns.length,
    ads: data.ads.filter((ad) => ad.campaignId && campaignIds.has(ad.campaignId)).length,
  };
}

/** O destino das campanhas é configurado só no detalhe da campanha. */
export function MetaEntries({ queueId, data }: { queueId: string | null; data: MetaEntriesData; canEdit?: boolean }) {
  const campaignsById = new Map(data.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const routes = data.campaignRoutes.filter((route) => queueId === null
    ? !route.enabled || !route.queueId
    : route.enabled && route.queueId === queueId);

  if (!routes.length) return <p className={pl.emptyBox}>Nenhuma campanha nesta lista.</p>;

  return (
    <div className={cn(pl.gx, pn.panel)} style={{ gap: 8 }}>
      <p className={pl.small}>A captura e a fila de cada campanha são gerenciadas no detalhe da campanha.</p>
      <ScrollArea className={pn.scrollList}>
        <ul className={pn.list}>
          {routes.map((route) => {
            const campaign = campaignsById.get(route.campaignId);
            const name = campaign?.name ?? route.campaignId;
            return (
              <li key={route.campaignId}>
                <Row1a1
                  title={name}
                  meta={!route.enabled ? "Captura pausada" : route.queueName ? `Fila ${route.queueName}` : "Fila não configurada; captura bloqueada"}
                  aside={(
                    <>
                      <span className={cn(pl.badge, route.enabled ? pl.bGood : undefined)}>{route.enabled ? "Captura ativa" : "Pausada"}</span>
                      <Link href={`/marketing/campanhas/${encodeURIComponent(route.campaignId)}`} aria-label={`Abrir a campanha ${name}`} className={cn(pl.iconbtn, pl.iconbtnGhost)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </Link>
                    </>
                  )}
                />
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </div>
  );
}
