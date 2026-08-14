"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowLeft, ArrowRight, ArrowsClockwise, Globe, Lightning, Power } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";

import { disconnectMetaConnection, triggerManualMetaSync } from "../actions";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaSyncLogItem } from "../types";
import { MetaMarketingWizard } from "./meta-marketing-wizard";

export function MetaIntegrationView({ connection, assets, logs, canConfigure = true }: { connection: MetaConnectionInfo | null; assets: MetaConnectionAssets | null; logs: MetaSyncLogItem[]; canConfigure?: boolean }) {
  const [syncing, setSyncing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
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

  return <div className="space-y-6">
    <Card className="border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div><CardTitle className="flex items-center gap-2"><Globe className="size-5 text-primary" />Meta Ads e Lead Ads</CardTitle><CardDescription>Conexão exclusiva de Marketing para páginas, campanhas, formulários, pixels e filas.</CardDescription></div>
        <Badge variant={connected ? "success" : "outline"}>{connected ? "Conectada" : "Não conectada"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {connected ? <>
            <Button variant="outline" disabled={syncing || !canConfigure} onClick={() => void sync()}><ArrowsClockwise className="size-4" />{syncing ? "Sincronizando…" : "Sincronizar"}</Button>
            <Button variant="outline" disabled={!canConfigure} onClick={() => setWizardOpen(true)}><Lightning className="size-4" />{permissionWarning ? "Reconectar permissões" : "Revisar ativos"}</Button>
            <Button variant="destructive" disabled={!canConfigure || disconnecting} onClick={() => setDisconnectOpen(true)}><Power className="size-4" />Desconectar</Button>
          </> : <Button disabled={!canConfigure} onClick={() => setWizardOpen(true)}><Lightning className="size-4" />Conectar Marketing</Button>}
        </div>
        {permissionWarning ? <div role="alert" className="rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm"><p className="font-medium text-foreground">Permissão de anúncios necessária</p><p className="mt-1 text-muted-foreground">{permissionWarning}</p><p className="mt-2 text-xs text-muted-foreground">A reconexão abre o consentimento da Meta novamente. Nenhum histórico ou fila do CRM será apagado.</p></div> : null}
      </CardContent>
    </Card>

    {connected && assets ? <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Perfil e ativos conectados</CardTitle><CardDescription>Veja apenas os ativos autorizados para esta corretora. Em Distribuição de Leads você escolhe quais campanhas entram no CRM e a fila de cada uma.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Portfólio empresarial</p><p className="mt-1 truncate text-sm font-semibold">{connection.businessName ?? "Nome não informado"}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{connection.businessId}</p></div><MetricCard label="Páginas autorizadas" value={assets.pages.length} /><MetricCard label="Campanhas sincronizadas" value={assets.campaigns.length} /><MetricCard label="Anúncios sincronizados" value={assets.ads.length} /></div><div className="grid gap-4 lg:grid-cols-2"><AssetList title="Páginas conectadas" empty="Nenhuma página selecionada." items={assets.pages.map((asset) => ({ ...asset, detail: asset.id }))} /><AssetList title="Contas de anúncios" empty="Nenhuma conta de anúncios selecionada." items={assets.adAccounts.map((asset) => ({ ...asset, detail: `${asset.id} · ${asset.currency}` }))} /></div><div className="grid gap-4 lg:grid-cols-2"><AssetList title="Pixels" empty="Nenhum pixel sincronizado ainda." items={assets.pixels.map((asset) => ({ ...asset, detail: asset.id }))} /><AssetList title="Fontes" empty="Nenhuma fonte sincronizada ainda." items={assets.datasets.map((asset) => ({ ...asset, detail: asset.id }))} /></div><div className="grid gap-4 lg:grid-cols-2"><AssetList title="Formulários de Lead Ads" empty="Nenhum formulário sincronizado ainda." items={assets.leadForms.map((asset) => ({ ...asset, detail: `Página ${asset.pageId}` }))} /><AssetList title="Campanhas" empty="Nenhuma campanha sincronizada ainda." items={assets.campaigns.map((asset) => ({ ...asset, detail: asset.adAccountId }))} /></div><AssetList title="Anúncios" empty="Nenhum anúncio sincronizado ainda." items={assets.ads.map((asset) => ({ ...asset, detail: `Conjunto ${asset.adSetId}` }))} /></CardContent></Card> : null}

    <Card className="border-border bg-card shadow-none"><CardHeader><CardTitle>Sincronizações recentes</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{logs.length ? <SyncLogsList logs={logs} /> : <p className="text-muted-foreground">Nenhuma sincronização registrada.</p>}</CardContent></Card>
    {wizardOpen ? <MetaMarketingWizard onClose={() => setWizardOpen(false)} /> : null}
    <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}><DialogPopup className="sm:max-w-md"><DialogHeader><DialogTitle>Desconectar Marketing da Meta?</DialogTitle><DialogDescription>As páginas, campanhas, formulários, pixels e filas deixam de sincronizar. A captura é interrompida, a Página fica disponível para uma conexão futura e o histórico já capturado é preservado.</DialogDescription></DialogHeader><DialogFooter><Button disabled={disconnecting} variant="outline" onClick={() => setDisconnectOpen(false)}>Cancelar</Button><Button disabled={disconnecting} onClick={handleDisconnect} variant="destructive">{disconnecting ? "Desconectando…" : "Desconectar"}</Button></DialogFooter></DialogPopup></Dialog>
  </div>;
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

const PAGE_SIZE = 15;

function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    total: items.length,
    start,
    end: Math.min(start + PAGE_SIZE, items.length),
    visible: items.slice(start, start + PAGE_SIZE),
    setPage,
  };
}

function PaginationFooter({ page, totalPages, total, start, end, onPageChange }: { page: number; totalPages: number; total: number; start: number; end: number; onPageChange: (page: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-mono text-xs text-muted-foreground">{start + 1}–{end} de {total}</p>
      <div className="flex items-center gap-1">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" variant="outline"><ArrowLeft className="size-4" />Anterior</Button>
        <Button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} size="sm" variant="outline">Próxima<ArrowRight className="size-4" /></Button>
      </div>
    </div>
  );
}

function AssetList({ title, empty, items }: { title: string; empty: string; items: Array<{ id: string; name: string; status: string; detail: string }> }) {
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
        <span className="font-mono text-xs text-muted-foreground">{items.length} item{items.length === 1 ? "" : "s"}</span>
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

function SyncLogsList({ logs }: { logs: MetaSyncLogItem[] }) {
  const { page, totalPages, total, start, end, visible, setPage } = usePaged(logs);
  return (
    <>
      <div className="space-y-2">
        {visible.map((log) => <div className="flex justify-between rounded-md border border-border p-3" key={log.id}><span>{log.syncType}</span><span>{log.status} · {log.itemsSynced} itens</span></div>)}
      </div>
      <PaginationFooter page={page} totalPages={totalPages} total={total} start={start} end={end} onPageChange={setPage} />
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}
