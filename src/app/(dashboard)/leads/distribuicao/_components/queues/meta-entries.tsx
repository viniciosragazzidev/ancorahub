"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Loader2Icon, Trash } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchAddList, type SearchAddItem } from "@/components/ui/search-add-list";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import {
  deleteMetaAdQueueRouteAction,
  deleteMetaCampaignQueueRouteAction,
  saveMetaAdQueueRouteAction,
  saveMetaCampaignQueueRouteAction,
} from "@/features/lead-distribution/actions";

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

const isActive = (status: string | null | undefined) => (status ?? "").toUpperCase() === "ACTIVE";

/** Where a campaign/ad currently goes, as a short hint ("Fila PME", "Ignorada"). */
function destinationLabel(route: { queueId: string | null; queueName: string | null; enabled: boolean } | undefined) {
  if (!route) return null;
  if (!route.enabled) return "Não registrada no CRM";
  return `Na fila ${route.queueName ?? "geral"}`;
}

/** Counts shown in the queues table: campaigns and loose ads routed to a queue. */
export function countQueueEntries(data: MetaEntriesData, queueId: string) {
  return {
    campaigns: data.campaignRoutes.filter((route) => route.enabled && route.queueId === queueId).length,
    ads: data.adRoutes.filter((route) => route.enabled && route.queueId === queueId).length,
  };
}

/**
 * Meta entries of one destination. `queueId` set: campaigns/ads routed to that
 * queue. `queueId` null: campaigns/ads marked "não registrar no CRM".
 * Adding a campaign brings all its ads (the engine routes by campaign); an ad
 * with its own rule still wins, as it always did.
 */
export function MetaEntries({ queueId, data, canEdit }: { queueId: string | null; data: MetaEntriesData; canEdit: boolean }) {
  const router = useRouter();
  const [onlyActive, setOnlyActive] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const ignoredMode = queueId === null;

  const campaignRouteById = useMemo(() => new Map(data.campaignRoutes.map((route) => [route.campaignId, route])), [data.campaignRoutes]);
  const adRouteById = useMemo(() => new Map(data.adRoutes.map((route) => [route.adId, route])), [data.adRoutes]);
  const campaignById = useMemo(() => new Map(data.campaigns.map((campaign) => [campaign.campaignId, campaign])), [data.campaigns]);
  const adsByCampaign = useMemo(() => {
    const map = new Map<string, MetaAd[]>();
    for (const ad of data.ads) {
      if (!ad.campaignId) continue;
      map.set(ad.campaignId, [...(map.get(ad.campaignId) ?? []), ad]);
    }
    return map;
  }, [data.ads]);

  const belongsHere = (route: { queueId: string | null; enabled: boolean } | undefined) =>
    Boolean(route) && (ignoredMode ? !route!.enabled : route!.enabled && route!.queueId === queueId);

  /** Ads of a campaign whose own rule sends them somewhere else (an ad rule wins over the campaign). */
  const adsElsewhere = (campaignId: string) =>
    (adsByCampaign.get(campaignId) ?? []).filter((ad) => {
      const own = adRouteById.get(ad.adId);
      return Boolean(own) && !belongsHere(own);
    });
  const describeElsewhere = (ads: MetaAd[]) => {
    const places = [...new Set(ads.map((ad) => destinationLabel(adRouteById.get(ad.adId))?.toLowerCase()).filter(Boolean))];
    return places.join(", ");
  };

  const allLinkedCampaigns = data.campaignRoutes.filter(belongsHere);
  const allLinkedAds = data.adRoutes.filter(belongsHere);
  // "Só ativos" also trims the linked list: paused entries stay routed, just hidden.
  const linkedCampaigns = onlyActive
    ? allLinkedCampaigns.filter((route) => isActive(campaignById.get(route.campaignId)?.status))
    : allLinkedCampaigns;
  const linkedAds = onlyActive
    ? allLinkedAds.filter((route) => isActive(data.ads.find((ad) => ad.adId === route.adId)?.status))
    : allLinkedAds;
  const hiddenCount = allLinkedCampaigns.length + allLinkedAds.length - linkedCampaigns.length - linkedAds.length;

  const searchItems = useMemo<SearchAddItem[]>(() => {
    const campaignItems = data.campaigns
      .filter((campaign) => (!onlyActive || isActive(campaign.status)) && !belongsHere(campaignRouteById.get(campaign.campaignId)))
      .map((campaign) => {
        const ads = adsByCampaign.get(campaign.campaignId) ?? [];
        const where = destinationLabel(campaignRouteById.get(campaign.campaignId));
        return {
          id: `campaign:${campaign.campaignId}`,
          label: campaign.name,
          tag: <Badge variant="outline" className="font-normal">Campanha</Badge>,
          hint: [isActive(campaign.status) ? "Ativa" : "Pausada", `${ads.length} anúncio${ads.length === 1 ? "" : "s"}`, where].filter(Boolean).join(" · "),
        };
      });
    // An ad without its own rule follows its campaign: when the campaign is
    // already here, the ad is too and is not offered again. An ad with its own
    // rule elsewhere (an exception) can still be brought here.
    const adItems = data.ads
      .filter((ad) => {
        if (onlyActive && !isActive(ad.status)) return false;
        const own = adRouteById.get(ad.adId);
        if (own) return !belongsHere(own);
        return !(ad.campaignId && belongsHere(campaignRouteById.get(ad.campaignId)));
      })
      .map((ad) => {
        const campaign = ad.campaignId ? campaignById.get(ad.campaignId) : undefined;
        const own = adRouteById.get(ad.adId);
        const viaCampaign = !own && ad.campaignId ? campaignRouteById.get(ad.campaignId) : undefined;
        const where = own ? destinationLabel(own) : viaCampaign ? `${destinationLabel(viaCampaign)} pela campanha` : null;
        return {
          id: `ad:${ad.adId}`,
          label: ad.name,
          keywords: campaign?.name,
          tag: <Badge variant="secondary" className="font-normal">Anúncio</Badge>,
          hint: [isActive(ad.status) ? "Ativo" : "Pausado", campaign ? `Campanha ${campaign.name}` : null, where].filter(Boolean).join(" · "),
        };
      });
    return [...campaignItems, ...adItems];
    // belongsHere depends only on queueId/ignoredMode, both covered below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, onlyActive, queueId, adsByCampaign, campaignById, campaignRouteById, adRouteById]);

  function run(id: string, task: () => Promise<{ success: boolean; error?: string; message?: string }>, done: string) {
    setBusyId(id);
    startTransition(async () => {
      const result = await task();
      setBusyId(null);
      if (!result.success) {
        toast.error(result.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success(done);
      router.refresh();
    });
  }

  function add(item: SearchAddItem) {
    const separator = item.id.indexOf(":");
    const kind = item.id.slice(0, separator);
    const id = item.id.slice(separator + 1);
    const current = kind === "campaign" ? campaignRouteById.get(id) : adRouteById.get(id);
    const where = destinationLabel(current);
    if (where && !window.confirm(`"${item.label}" está hoje: ${where}. Mover para ${ignoredMode ? "não registrar no CRM" : "esta fila"}?`)) return;
    const input = { queueId: ignoredMode ? null : queueId, enabled: !ignoredMode };
    if (kind === "campaign") {
      // Ads with their own rule would not come along: ask once, right here.
      const elsewhere = ignoredMode ? [] : adsElsewhere(id);
      const includeAds = elsewhere.length > 0 && window.confirm(
        `${elsewhere.length} anúncio${elsewhere.length === 1 ? "" : "s"} desta campanha ${elsewhere.length === 1 ? "tem" : "têm"} regra própria e ${elsewhere.length === 1 ? "vai" : "vão"} para outro lugar (${describeElsewhere(elsewhere)}).

OK: trazer esses anúncios para esta fila junto com a campanha.
Cancelar: adicionar só a campanha e manter essas exceções.`,
      );
      run(item.id, () => saveMetaCampaignQueueRouteAction({ campaignId: id, ...input, includeAds }), ignoredMode
        ? "Campanha não será registrada."
        : elsewhere.length && !includeAds
          ? `Campanha adicionada. ${elsewhere.length} anúncio${elsewhere.length === 1 ? "" : "s"} com regra própria ${elsewhere.length === 1 ? "continua" : "continuam"} fora desta fila.`
          : "Campanha adicionada com todos os anúncios dela.");
    } else {
      run(item.id, () => saveMetaAdQueueRouteAction({ adId: id, ...input }), ignoredMode ? "Anúncio não será registrado." : "Anúncio adicionado à fila.");
    }
  }

  function bringCampaignAds(campaignId: string, name: string, count: number) {
    if (!queueId || !window.confirm(`Trazer para esta fila ${count} anúncio${count === 1 ? "" : "s"} de "${name}" que hoje ${count === 1 ? "vai" : "vão"} para outro lugar? A regra própria ${count === 1 ? "dele é removida e ele passa" : "deles é removida e eles passam"} a seguir a campanha.`)) return;
    run(`campaign:${campaignId}`, () => saveMetaCampaignQueueRouteAction({ campaignId, queueId, enabled: true, includeAds: true }), "Anúncios trazidos para esta fila.");
  }

  function removeCampaign(campaignId: string, name: string) {
    if (!window.confirm(`Remover "${name}"? A campanha volta para a fila geral.`)) return;
    run(`campaign:${campaignId}`, () => deleteMetaCampaignQueueRouteAction(campaignId), "Campanha removida.");
  }

  function removeAd(adId: string, name: string) {
    if (!window.confirm(`Remover "${name}"? O anúncio volta a seguir a campanha.`)) return;
    run(`ad:${adId}`, () => deleteMetaAdQueueRouteAction(adId), "Anúncio removido.");
  }

  const removeButton = (id: string, label: string, onClick: () => void) =>
    canEdit ? (
      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Remover ${label}`} title={`Remover ${label}`} disabled={Boolean(busyId)} onClick={onClick}>
        {busyId === id ? <Loader2Icon className="size-4 animate-spin" /> : <Trash className="size-4" />}
      </Button>
    ) : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {canEdit ? (
        <SearchAddList
          items={searchItems}
          onAdd={add}
          addingId={busyId}
          placeholder="Buscar campanha ou anúncio"
          emptyLabel={data.campaigns.length ? "Nenhuma campanha ou anúncio encontrado." : "Nenhuma campanha Meta sincronizada."}
          toolbar={
            <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <Switch checked={onlyActive} onCheckedChange={setOnlyActive} aria-label="Mostrar só ativos" />
              Só ativos
            </label>
          }
        />
      ) : null}

      {hiddenCount > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {hiddenCount} pausada{hiddenCount === 1 ? "" : "s"} oculta{hiddenCount === 1 ? "" : "s"} —{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setOnlyActive(false)}>
            mostrar todas
          </button>
        </p>
      ) : null}

      {linkedCampaigns.length || linkedAds.length ? (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/70">
          {linkedCampaigns.map((route) => {
            const campaign = campaignById.get(route.campaignId);
            const name = campaign?.name ?? route.campaignId;
            const ads = adsByCampaign.get(route.campaignId) ?? [];
            const elsewhere = ignoredMode ? [] : adsElsewhere(route.campaignId);
            const included = ads.length - elsewhere.length;
            return (
              <li key={route.campaignId} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                      <Badge variant="outline" className="font-normal">Campanha</Badge>
                      <span className="truncate">{name}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {isActive(campaign?.status) ? "Ativa" : "Pausada"} · {included} anúncio{included === 1 ? "" : "s"} incluído{included === 1 ? "" : "s"}
                      {elsewhere.length ? <span className="text-foreground"> · {elsewhere.length} com regra própria ({describeElsewhere(elsewhere)})</span> : null}
                    </p>
                    {elsewhere.length && canEdit ? (
                      <button type="button" className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50" disabled={Boolean(busyId)} onClick={() => bringCampaignAds(route.campaignId, name, elsewhere.length)}>
                        Trazer para esta fila
                      </button>
                    ) : null}
                  </div>
                  {removeButton(`campaign:${route.campaignId}`, name, () => removeCampaign(route.campaignId, name))}
                </div>
                {ads.length ? (
                  <details className="group mt-1">
                    <summary className="cursor-pointer list-none text-[11px] font-medium text-primary hover:underline">
                      Ver anúncios
                    </summary>
                    <ul className="mt-1.5 grid gap-1 border-l border-border/70 pl-3">
                      {ads.map((ad) => {
                        const own = adRouteById.get(ad.adId);
                        const exception = own && !belongsHere(own) ? destinationLabel(own) : null;
                        return (
                          <li key={ad.adId} className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="truncate text-foreground">{ad.name}</span>
                            <span className="shrink-0 text-muted-foreground">
                              {exception ? `Exceção: ${exception.toLowerCase()}` : isActive(ad.status) ? "Ativo" : "Pausado"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
          {linkedAds.map((route) => {
            const ad = data.ads.find((item) => item.adId === route.adId);
            const name = ad?.name ?? route.adId;
            const campaign = ad?.campaignId ? campaignById.get(ad.campaignId) : undefined;
            return (
              <li key={route.adId} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                    <Badge variant="secondary" className="font-normal">Anúncio</Badge>
                    <span className="truncate">{name}</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {isActive(ad?.status) ? "Ativo" : "Pausado"}{campaign ? ` · Campanha ${campaign.name}` : ""}
                  </p>
                </div>
                {removeButton(`ad:${route.adId}`, name, () => removeAd(route.adId, name))}
              </li>
            );
          })}
        </ul>
      ) : hiddenCount > 0 ? null : (
        <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">
          {ignoredMode
            ? "Nenhuma campanha ou anúncio marcado para não registrar."
            : "Sem campanha vinculada: esta fila recebe pelas regras gerais (fila geral, fontes e plantões)."}
        </p>
      )}
    </div>
  );
}
