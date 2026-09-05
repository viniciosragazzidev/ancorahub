"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Globe,
  Lightning,
  MagnifyingGlass,
  Power,
  SlidersHorizontal,
  XCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  batchSetMetaCaptureEligibilityAction,
  disconnectMetaConnection,
  setMetaGlobalCaptureModeAction,
  toggleMetaAdCaptureEligibilityAction,
  toggleMetaCampaignCaptureEligibilityAction,
  toggleMetaFormCaptureEligibilityAction,
  triggerManualMetaSync,
} from "../actions";
import type { MetaConnectionAssets, MetaConnectionInfo, MetaSyncLogItem } from "../types";
import { MetaMarketingWizard } from "./meta-marketing-wizard";

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
        <CardContent className="space-y-3">
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
        <>
          {/* Master Lead Capture Control Card */}
          <MetaMasterCaptureControl globalMode={connection.globalCaptureMode ?? "selective"} canConfigure={canConfigure} />

          {/* Connected Assets Card & Management */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Perfil e ativos conectados</CardTitle>
              <CardDescription>
                Veja os ativos autorizados para esta corretora. Escolha abaixo ou em Marketing/Campanhas quais campanhas capturam leads no CRM.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">Portfólio empresarial</p>
                  <p className="mt-1 truncate text-sm font-semibold">{connection.businessName ?? "Nome não informado"}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{connection.businessId}</p>
                </div>
                <MetricCard label="Páginas autorizadas" value={assets.pages.length} />
                <MetricCard label="Campanhas sincronizadas" value={assets.campaigns.length} />
                <MetricCard label="Anúncios sincronizados" value={assets.ads.length} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <AssetList title="Páginas conectadas" empty="Nenhuma página selecionada." items={assets.pages.map((asset) => ({ ...asset, detail: asset.id }))} />
                <AssetList title="Contas de anúncios" empty="Nenhuma conta de anúncios selecionada." items={assets.adAccounts.map((asset) => ({ ...asset, detail: `${asset.id} · ${asset.currency}` }))} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <AssetList title="Pixels" empty="Nenhum pixel sincronizado ainda." items={assets.pixels.map((asset) => ({ ...asset, detail: asset.id }))} />
                <AssetList title="Fontes" empty="Nenhuma fonte sincronizada ainda." items={assets.datasets.map((asset) => ({ ...asset, detail: asset.id }))} />
              </div>

              {/* Interactive Multi-Select Checkbox Asset Lists for Forms, Campaigns, and Ads */}
              <div className="space-y-6">
                <SelectableAssetList
                  title="Formulários de Lead Ads"
                  empty="Nenhum formulário sincronizado ainda."
                  assetType="forms"
                  canConfigure={canConfigure}
                  items={assets.leadForms.map((f) => ({
                    id: f.id,
                    name: f.name,
                    status: f.status,
                    detail: `Página: ${f.pageId}`,
                    isEligibleForCapture: f.isEligibleForCapture,
                  }))}
                />
                <SelectableAssetList
                  title="Campanhas & Captura CRM"
                  empty="Nenhuma campanha sincronizada ainda."
                  assetType="campaigns"
                  canConfigure={canConfigure}
                  items={assets.campaigns.map((c) => ({
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    detail: `Conta: ${c.adAccountId}`,
                    isEligibleForCapture: c.isEligibleForCapture,
                  }))}
                />
                <SelectableAssetList
                  title="Anúncios & Captura CRM"
                  empty="Nenhum anúncio sincronizado ainda."
                  assetType="ads"
                  canConfigure={canConfigure}
                  items={assets.ads.map((ad) => ({
                    id: ad.id,
                    name: ad.name,
                    status: ad.status,
                    detail: `Conjunto: ${ad.adSetId}`,
                    isEligibleForCapture: ad.isEligibleForCapture,
                  }))}
                />
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card className="border-border bg-card shadow-none">
        <CardHeader>
          <CardTitle>Sincronizações recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {logs.length ? <SyncLogsList logs={logs} /> : <p className="text-muted-foreground">Nenhuma sincronização registrada.</p>}
        </CardContent>
      </Card>
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

function MetaMasterCaptureControl({
  globalMode,
  canConfigure,
}: {
  globalMode: "all" | "selective" | "disabled";
  canConfigure: boolean;
}) {
  const [updating, setUpdating] = useState(false);
  const [currentMode, setCurrentMode] = useState(globalMode);
  const router = useRouter();

  const handleModeChange = async (newMode: "all" | "selective" | "disabled") => {
    setUpdating(true);
    try {
      const res = await setMetaGlobalCaptureModeAction({ mode: newMode });
      if (res.success) {
        setCurrentMode(newMode);
        if (newMode === "disabled") {
          toast.success("Captura geral desativada! Nenhum lead Meta entrará no CRM.", { description: "Todos os webhooks Meta serão ignorados até reativar." });
        } else if (newMode === "all") {
          toast.success("Captura global ativada! Todas as campanhas e anúncios capturarão leads.", { description: "Leads de qualquer campanha entrarão no CRM." });
        } else {
          toast.success("Modo seletivo ativado!", { description: "Apenas as campanhas, anúncios ou formulários selecionados capturarão leads." });
        }
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao alterar modo de captura.");
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card className="border-2 border-primary/20 bg-card shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="size-5 text-primary" />
              Controle Mestre de Captura Meta Lead Ads
            </CardTitle>
            <CardDescription className="text-xs">
              Defina a regra global para o recebimento de leads do Facebook e Instagram no CRM.
            </CardDescription>
          </div>
          <div>
            {currentMode === "disabled" ? (
              <Badge variant="destructive" className="px-3 py-1 text-xs font-semibold">
                Captura geral desativada
              </Badge>
            ) : currentMode === "all" ? (
              <Badge variant="success" className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 px-3 py-1 text-xs font-semibold">
                Captura global ativa
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 px-3 py-1 text-xs font-semibold">
                Modo seletivo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <AppSelect
              aria-label="Controle Mestre de Captura Meta Lead Ads"
              disabled={!canConfigure || updating}
              value={currentMode}
              onValueChange={(val) => void handleModeChange(val as "all" | "selective" | "disabled")}
              options={[
                {
                  value: "selective",
                  label: "Capturar apenas selecionados (recomendado)",
                },
                {
                  value: "all",
                  label: "Ativar todos os ativos",
                },
                {
                  value: "disabled",
                  label: "Desativar toda a captura",
                },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            {currentMode !== "disabled" ? (
              <Button
                variant="destructive"
                size="sm"
                disabled={!canConfigure || updating}
                onClick={() => void handleModeChange("disabled")}
                className="w-full text-xs font-medium"
              >
                Pausar Todos os Leads
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                disabled={!canConfigure || updating}
                onClick={() => void handleModeChange("selective")}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
              >
                Ativar Captura Seletiva
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AssetItem = {
  id: string;
  name: string;
  status: string;
  detail: string;
  isEligibleForCapture?: boolean;
};

function SelectableAssetList({
  title,
  empty,
  assetType,
  canConfigure,
  items,
}: {
  title: string;
  empty: string;
  assetType: "campaigns" | "ads" | "forms";
  canConfigure: boolean;
  items: AssetItem[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eligibilityOverrides, setEligibilityOverrides] = useState<Map<string, boolean>>(new Map());
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const router = useRouter();

  const effectiveItems = useMemo(
    () => items.map((item) => ({
      ...item,
      isEligibleForCapture: eligibilityOverrides.get(item.id) ?? item.isEligibleForCapture,
    })),
    [eligibilityOverrides, items],
  );

  const filteredItems = effectiveItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ELEGIBLE ITEMS AT THE VERY TOP
  const sortedItems = [...filteredItems].sort((a, b) => {
    const aEligible = a.isEligibleForCapture ? 1 : 0;
    const bEligible = b.isEligibleForCapture ? 1 : 0;
    if (bEligible !== aEligible) return bEligible - aEligible;

    const aActive = a.status === "active" || a.status === "ACTIVE";
    const bActive = b.status === "active" || b.status === "ACTIVE";
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return a.name.localeCompare(b.name);
  });

  const { page, totalPages, total, start, end, visible, setPage } = usePaged(sortedItems);

  const toggleSelectAllVisible = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      visible.forEach((item) => next.add(item.id));
    } else {
      visible.forEach((item) => next.delete(item.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const allVisibleSelected =
    visible.length > 0 && visible.every((item) => selectedIds.has(item.id));

  const handleBatchToggle = async (enabled: boolean) => {
    if (selectedIds.size === 0) return;
    setBatchUpdating(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await batchSetMetaCaptureEligibilityAction({
        assetType,
        assetIds: ids,
        enabled,
      });
      if (res.success) {
        toast.success(
          enabled
            ? `${ids.length} item(s) ativado(s) para captura de leads!`
            : `Captura desativada para ${ids.length} item(s).`
        );
        setSelectedIds(new Set());
        setEligibilityOverrides((current) => {
          const next = new Map(current);
          ids.forEach((id) => next.set(id, enabled));
          return next;
        });
      } else {
        toast.error(res.error || "Erro na atualização em lote.");
      }
    } finally {
      setBatchUpdating(false);
    }
  };

  const handleSingleToggle = async (item: AssetItem) => {
    setUpdatingId(item.id);
    try {
      const nextEligible = !item.isEligibleForCapture;
      let res: { success: boolean; error?: string };

      if (assetType === "campaigns") {
        res = await toggleMetaCampaignCaptureEligibilityAction({ campaignId: item.id, enabled: nextEligible });
      } else if (assetType === "ads") {
        res = await toggleMetaAdCaptureEligibilityAction({ adId: item.id, enabled: nextEligible });
      } else {
        res = await toggleMetaFormCaptureEligibilityAction({ formId: item.id, enabled: nextEligible });
      }

      if (res.success) {
        toast.success(
          nextEligible
            ? "Ativado para captura de leads no CRM!"
            : "Captura desativada para este item."
        );
        setEligibilityOverrides((current) => new Map(current).set(item.id, nextEligible));
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao atualizar elegibilidade.");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const eligibleCount = effectiveItems.filter((i) => i.isEligibleForCapture).length;

  return (
    <section aria-label={title} className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/30 px-4 py-3 gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">Elegíveis no topo. Pesquise e marque com checkbox os itens ativados.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            {eligibleCount} elegível{eligibleCount === 1 ? "" : "s"}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">{items.length} total</span>
        </div>
      </div>

      {/* Search & Bulk Checkbox Action Bar */}
      <div className="p-3 border-b border-border bg-muted/10 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar por nome ou ID..."
              className="pl-9 h-8 text-xs"
            />
          </div>
          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-md px-2.5 py-1">
              <span className="text-xs font-semibold text-primary">
                {selectedIds.size} selecionado(s)
              </span>
              <Button
                size="sm"
                disabled={!canConfigure || batchUpdating}
                onClick={() => void handleBatchToggle(true)}
                className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-2"
              >
                <Check className="size-3 mr-1" />
                Ativar Captura
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canConfigure || batchUpdating}
                onClick={() => void handleBatchToggle(false)}
                className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2"
              >
                <XCircle className="size-3 mr-1" />
                Desativar
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-border">
        {visible.length ? (
          <>
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/40 text-[11px] text-muted-foreground font-medium">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(chk) => toggleSelectAllVisible(Boolean(chk))}
              />
              <span className="flex-1">Selecione para ação em lote (Elegíveis no topo)</span>
              <span className="w-24 text-right">Status</span>
            </div>
            {visible.map((item) => {
              const isEligible = Boolean(item.isEligibleForCapture);
              const isChecked = selectedIds.has(item.id);
              const isUpdating = updatingId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors",
                    isEligible
                      ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-l-4 border-l-emerald-500"
                      : "hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleSelectItem(item.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        {isEligible ? (
                          <Badge
                            variant="success"
                            className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold border-emerald-500/40"
                          >
                            Elegível para captura
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Captura desativada
                          </Badge>
                        )}
                      </div>
                      <p className="truncate font-mono text-xs text-muted-foreground mt-0.5">
                        {item.detail} · ID: {item.id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.status === "active" || item.status === "ACTIVE" ? "outline" : "secondary"}
                      className="text-[10px]"
                    >
                      {item.status === "active" || item.status === "ACTIVE" ? "Ativo" : item.status}
                    </Badge>
                    <Button
                      size="sm"
                      variant={isEligible ? "outline" : "default"}
                      disabled={!canConfigure || isUpdating}
                      onClick={() => void handleSingleToggle(item)}
                      className={cn(
                        "h-7 text-xs font-medium",
                        !isEligible && "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                    >
                      {isUpdating ? "Salvando…" : isEligible ? "Desativar Captura" : "Tornar Elegível"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        <PaginationFooter page={page} totalPages={totalPages} total={total} start={start} end={end} onPageChange={setPage} />
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

function PaginationFooter({
  page,
  totalPages,
  total,
  start,
  end,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-mono text-xs text-muted-foreground">
        {start + 1}–{end} de {total}
      </p>
      <div className="flex items-center gap-1">
        <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" variant="outline">
          <ArrowLeft className="size-4" />
          Anterior
        </Button>
        <Button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} size="sm" variant="outline">
          Próxima
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
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

function SyncLogsList({ logs }: { logs: MetaSyncLogItem[] }) {
  const { page, totalPages, total, start, end, visible, setPage } = usePaged(logs);
  return (
    <>
      <div className="space-y-2">
        {visible.map((log) => (
          <div className="flex justify-between rounded-md border border-border p-3" key={log.id}>
            <span>{log.syncType}</span>
            <span>
              {log.status} · {log.itemsSynced} itens
            </span>
          </div>
        ))}
      </div>
      <PaginationFooter page={page} totalPages={totalPages} total={total} start={start} end={end} onPageChange={setPage} />
    </>
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
