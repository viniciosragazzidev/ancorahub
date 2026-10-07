import Link from "next/link";
import { ArrowRight } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

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

/** Campaign destinations are configured only in the campaign detail page. */
export function MetaEntries({ queueId, data }: { queueId: string | null; data: MetaEntriesData; canEdit?: boolean }) {
  const campaignsById = new Map(data.campaigns.map((campaign) => [campaign.campaignId, campaign]));
  const routes = data.campaignRoutes.filter((route) => queueId === null
    ? !route.enabled || !route.queueId
    : route.enabled && route.queueId === queueId);

  if (!routes.length) {
    return <p className="text-xs text-muted-foreground">Nenhuma campanha nesta lista.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">A captura e a fila de cada campanha são gerenciadas no detalhe da campanha.</p>
      <ul className="divide-y divide-border/60 rounded-md border border-border/70">
        {routes.map((route) => {
          const campaign = campaignsById.get(route.campaignId);
          const name = campaign?.name ?? route.campaignId;
          return (
            <li key={route.campaignId} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{name}</p>
                <p className="text-[11px] text-muted-foreground">{!route.enabled ? "Captura pausada" : route.queueName ? `Fila ${route.queueName}` : "Fila não configurada; captura bloqueada"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={route.enabled ? "success" : "outline"} className="text-[10px]">
                  {route.enabled ? "Captura ativa" : "Pausada"}
                </Badge>
                <Link
                  href={`/marketing/campanhas/${encodeURIComponent(route.campaignId)}`}
                  aria-label={`Configurar ${name}`}
                  title="Abrir campanha"
                  className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                >
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
