"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { ArrowRight, ArrowsClockwise, Globe, Lightning, Power } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";

import { disconnectMetaConnection, triggerManualMetaSync } from "../actions";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaSyncLogItem } from "../types";
import { CAPTURE_MODE_LABEL } from "../meta-sync-status";
import { PaginationFooter, usePaged } from "./meta-asset-paging";
import { MetaMarketingWizard } from "./meta-marketing-wizard";
import { MetaSyncBadge } from "./meta-sync-badge";

/**
 * Visão, conexão e sincronização da Meta. O CONTROLE (modo de captura, o que
 * captura, fila) vive em /marketing/campanhas; aqui só se lê o estado.
 */
export function MetaIntegrationView({
  connection,
  assets,
  logs,
  canConfigure = true,
}: {
  connection: MetaConnectionInfo | null;
  assets: MetaConnectionAssets | null;
  logs: MetaSyncLogItem[];
  canConfigure?: boolean;
}) {
  const [syncing, setSyncing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  // O mapa pode ter centenas de campanhas: só entra no DOM quando aberto.
  const [mapOpen, setMapOpen] = useState(false);
  const [disconnecting, startDisconnecting] = useTransition();
  const router = useRouter();
  const connected = connection?.status === "connected";
  const permissionWarning = getPermissionWarning(connection?.lastError);

  const sync = async () => {
    setSyncing(true);
    try {
      const result = await triggerManualMetaSync();
      if (!result.success) {
        toast.error(result.error ?? "A sincronização não foi concluída.");
        return;
      }
      if (result.warnings?.length) {
        toast.warning("Sincronização parcial da Meta.", { description: result.warnings[0]?.message });
      } else {
        toast.success("Ativos sincronizados.");
      }
      router.refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = () => {
    startDisconnecting(async () => {
      try {
        await disconnectMetaConnection();
        setDisconnectOpen(false);
        toast.success("Conexão de Marketing desconectada.", { description: "Ativos e captura foram liberados; o histórico foi preservado." });
        router.refresh();
      } catch (cause) {
        toast.error(cause instanceof Error ? cause.message : "Não foi possível desconectar a Meta agora.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-5 text-primary" />
              Meta Ads e Lead Ads
            </CardTitle>
            <CardDescription>
              Conexão exclusiva de Marketing para páginas, campanhas, formulários, pixels e filas.
            </CardDescription>
          </div>
          <Badge variant={connected ? "success" : "outline"}>{connected ? "Conectada" : "Não conectada"}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <MetaSyncBadge logs={logs} lastSyncedAt={connection?.lastSyncedAt} />
                <Badge variant="outline" data-slot="capture-mode">
                  {CAPTURE_MODE_LABEL[connection?.globalCaptureMode ?? "selective"]}
                </Badge>
              </div>
              <Link
                href="/marketing/campanhas"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Gerenciar captura e filas
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <>
                <Button variant="outline" disabled={syncing || !canConfigure} onClick={() => void sync()}>
                  <ArrowsClockwise className="size-4" />
                  {syncing ? "Sincronizando…" : "Sincronizar"}
                </Button>
                <Button variant="outline" disabled={!canConfigure} onClick={() => setWizardOpen(true)}>
                  <Lightning className="size-4" />
                  {permissionWarning ? "Reconectar permissões" : "Revisar ativos"}
                </Button>
                <Button variant="destructive" disabled={!canConfigure || disconnecting} onClick={() => setDisconnectOpen(true)}>
                  <Power className="size-4" />
                  Desconectar
                </Button>
              </>
            ) : (
              <Button disabled={!canConfigure} onClick={() => setWizardOpen(true)}>
                <Lightning className="size-4" />
                Conectar Marketing
              </Button>
            )}
          </div>
          {permissionWarning ? (
            <div role="alert" className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm">
              <p className="font-medium text-foreground">Permissão de anúncios necessária</p>
              <p className="mt-1 text-muted-foreground">{permissionWarning}</p>
              <p className="mt-2 text-xs text-muted-foreground">A reconexão abre o consentimento da Meta novamente. Nenhum histórico ou fila do CRM será apagado.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {connected && assets && connection ? (
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Ativos conectados</CardTitle>
            <CardDescription>
              Visão dos ativos autorizados para esta corretora. Para escolher o que captura leads e para qual fila,
              use Marketing › Campanhas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">Portfólio empresarial</p>
                <p className="mt-1 truncate text-sm font-semibold">{connection.businessName ?? "Nome não informado"}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{connection.businessId}</p>
              </div>
              <MetricCard label="Páginas autorizadas" value={assets.pages.length} />
              <MetricCard label="Campanhas sincronizadas" value={assets.campaigns.length} />
              <MetricCard label="Anúncios sincronizados" value={assets.ads.length} />
              <MetricCard label="Formulários sincronizados" value={assets.leadForms.length} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AssetList title="Páginas conectadas" empty="Nenhuma página selecionada." items={assets.pages.map((asset) => ({ ...asset, detail: asset.id }))} />
              <AssetList title="Contas de anúncios" empty="Nenhuma conta de anúncios selecionada." items={assets.adAccounts.map((asset) => ({ ...asset, detail: `${asset.id} · ${asset.currency}` }))} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <AssetList title="Pixels" empty="Nenhum pixel sincronizado ainda." items={assets.pixels.map((asset) => ({ ...asset, detail: asset.id }))} />
              <AssetList title="Fontes" empty="Nenhuma fonte sincronizada ainda." items={assets.datasets.map((asset) => ({ ...asset, detail: asset.id }))} />
            </div>

            <details className="group rounded-lg border border-border bg-muted/10" onToggle={(event) => setMapOpen(event.currentTarget.open)}>
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  <span>Mapa de aquisição</span>
                  <span className="text-xs font-normal text-muted-foreground group-open:hidden">Mostrar</span>
                  <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Ocultar</span>
                </span>
              </summary>
              {mapOpen ? (
                <div className="border-t border-border p-4">
                  <MetaAssetHierarchy campaigns={assets.campaigns} ads={assets.ads} forms={assets.leadForms} pages={assets.pages} />
                </div>
              ) : null}
            </details>
          </CardContent>
        </Card>
      ) : null}

      {wizardOpen ? <MetaMarketingWizard onClose={() => setWizardOpen(false)} /> : null}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogPopup key={disconnectOpen ? "open" : "closed"} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desconectar Marketing da Meta?</DialogTitle>
            <DialogDescription>
              As páginas, campanhas, formulários, pixels e filas deixam de sincronizar. A captura é interrompida, a Página fica disponível para uma conexão futura e o histórico já capturado é preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={disconnecting} variant="outline" onClick={() => setDisconnectOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={disconnecting} onClick={handleDisconnect} variant="destructive">
              {disconnecting ? "Desconectando…" : "Desconectar"}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

function MetaAssetHierarchy({
  campaigns,
  ads,
  forms,
  pages,
}: {
  campaigns: MetaConnectionAssets["campaigns"];
  ads: MetaConnectionAssets["ads"];
  forms: MetaConnectionAssets["leadForms"];
  pages: MetaConnectionAssets["pages"];
}) {
  const pageNameById = new Map(pages.map((page) => [page.id, page.name]));
  const formsByPage = new Map<string, typeof forms>();
  for (const form of forms) {
    const pageForms = formsByPage.get(form.pageId) ?? [];
    pageForms.push(form);
    formsByPage.set(form.pageId, pageForms);
  }

  return (
    <section aria-label="Mapa de ativos Meta" className="max-h-[34rem] overflow-y-auto rounded-lg border border-border bg-card">
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <p className="text-sm font-semibold">Mapa de aquisição</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Relação operacional entre campanha, anúncio e formulário. Os IDs ficam visíveis apenas como referência técnica.
        </p>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campanhas e anúncios</p>
          {campaigns.length ? campaigns.map((campaign) => {
            const campaignAds = ads.filter((ad) => ad.campaignId === campaign.id);
            return (
              <div key={campaign.id} className="rounded-md border border-border/70 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{campaign.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">Campanha · {campaign.id}</p>
                  </div>
                  <Badge variant={campaign.isEligibleForCapture ? "success" : "outline"} className="text-[10px]">
                    {campaign.isEligibleForCapture ? "Captura ativa" : "Fora da captura"}
                  </Badge>
                </div>
                {campaignAds.length ? (
                  <div className="mt-3 space-y-1.5 border-l-2 border-primary/20 pl-3">
                    {campaignAds.map((ad) => (
                      <div key={ad.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ad.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">Anúncio · {ad.id} · Conjunto · {ad.adSetId}</p>
                        </div>
                        <Badge variant={ad.isEligibleForCapture ? "success" : "outline"} className="text-[10px]">
                          {ad.isEligibleForCapture ? "Elegível" : "Desativado"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-2 text-xs text-muted-foreground">Nenhum anúncio sincronizado.</p>}
              </div>
            );
          }) : <p className="text-sm text-muted-foreground">Nenhuma campanha sincronizada.</p>}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formulários por Página</p>
          {formsByPage.size ? Array.from(formsByPage.entries()).map(([pageId, pageForms]) => (
            <div key={pageId} className="rounded-md border border-border/70 bg-muted/10 p-3">
              <p className="text-xs font-semibold">{pageNameById.get(pageId) ?? "Página sem nome"}</p>
              <p className="font-mono text-[10px] text-muted-foreground">Página · {pageId}</p>
              <div className="mt-2 space-y-2">
                {pageForms.map((form) => (
                  <div key={form.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{form.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">Formulário · {form.id}</p>
                    </div>
                    <Badge variant={form.isEligibleForCapture ? "success" : "outline"} className="text-[10px]">
                      {form.isEligibleForCapture ? "Elegível" : "Desativado"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhum formulário sincronizado.</p>}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A Meta mantém formulários no nível da Página. A ligação com a campanha só é exibida quando o anúncio fornece essa atribuição.
          </p>
        </div>
      </div>
      <div className="border-t border-border bg-muted/10 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fluxo operacional</p>
        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <p><span className="font-semibold text-foreground">1. Recuperado:</span> a Meta envia o lead pelo webhook e a atribuição é preservada.</p>
          <p><span className="font-semibold text-foreground">2. Consumido:</span> o CRM valida o modo global e a regra mais específica ativa.</p>
          <p><span className="font-semibold text-foreground">3. Distribuído:</span> a fila da regra recebe o lead; sem fila específica, vale a fila padrão.</p>
        </div>
      </div>
    </section>
  );
}

function getPermissionWarning(lastError: string | null | undefined) {
  if (!lastError) return null;
  try {
    const parsed = JSON.parse(lastError) as { warnings?: Array<{ code?: string; message?: string }> };
    return parsed.warnings?.find((warning) => warning.code === "missing_ads_read")?.message ?? null;
  } catch {
    return null;
  }
}

function AssetList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; name: string; status: string; detail: string }>;
}) {
  const sortedItems = [...items].sort((a, b) => {
    const aActive = a.status === "active" || a.status === "ACTIVE";
    const bActive = b.status === "active" || b.status === "ACTIVE";
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return a.name.localeCompare(b.name);
  });
  const { page, totalPages, total, start, end, visible, setPage } = usePaged(sortedItems);

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <span className="font-mono text-xs text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="divide-y divide-border">
        {visible.length ? (
          visible.map((item) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <Badge variant={item.status === "active" || item.status === "ACTIVE" ? "success" : "outline"}>
                {item.status === "active" || item.status === "ACTIVE" ? "Ativo" : item.status}
              </Badge>
            </div>
          ))
        ) : (
          <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
      <div className="border-t border-border px-4 py-2.5">
        <PaginationFooter page={page} totalPages={totalPages} total={total} start={start} end={end} onPageChange={setPage} />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
