"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import { Check, MagnifyingGlass, SlidersHorizontal, XCircle } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  batchSetMetaCaptureEligibilityAction,
  setMetaGlobalCaptureModeAction,
  toggleMetaAdCaptureEligibilityAction,
  toggleMetaCampaignCaptureEligibilityAction,
  toggleMetaFormCaptureEligibilityAction,
} from "../actions";
import type { MetaConnectionAssets } from "../types";
import { PaginationFooter, usePaged } from "./meta-asset-paging";

/**
 * Controle de captura da Meta. Vivia em /integrations/meta; agora mora em
 * /marketing/campanhas, onde se decide o que entra no CRM. O código foi MOVIDO
 * sem alteração de comportamento (mesmas ações de servidor, mesmas regras).
 */

export function MetaMasterCaptureControl({
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
          toast.success("Captura global ativada! Todos os ativos elegíveis capturarão leads.", { description: "Campanhas, anúncios e formulários ativos entrarão no CRM." });
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

export type AssetItem = {
  id: string;
  name: string;
  status: string;
  detail: string;
  isEligibleForCapture?: boolean;
  inheritedFromCampaignId?: string | null;
  inheritedFromCampaignIds?: string[];
};

export function SelectableAssetList({
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
                            {item.inheritedFromCampaignId || item.inheritedFromCampaignIds?.length
                              ? "Herdado da campanha"
                              : "Elegível para captura"}
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
                      {item.inheritedFromCampaignId || item.inheritedFromCampaignIds?.length ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          A campanha elegível autoriza este ativo automaticamente; uma regra específica ainda pode definir outra fila.
                        </p>
                      ) : null}
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

/**
 * Captura por ativo: formulários e anúncios (independentes das campanhas) e
 * campanhas em lote. Cada lista tem busca, seleção em lote e paginação.
 */
export function MetaAssetCaptureCard({
  assets,
  canConfigure,
}: {
  assets: MetaConnectionAssets;
  canConfigure: boolean;
}) {
  return (
    <Card className="border-border bg-card shadow-none">
      <CardHeader>
        <CardTitle>Captura por ativo</CardTitle>
        <CardDescription>
          Formulários e anúncios funcionam de forma independente das campanhas. Ative um por um ou em lote.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="forms" variant="underline" className="w-full gap-4">
          <TabsList aria-label="Tipo de ativo">
            <TabsTrigger value="forms">Formulários ({assets.leadForms.length})</TabsTrigger>
            <TabsTrigger value="ads">Anúncios ({assets.ads.length})</TabsTrigger>
            <TabsTrigger value="campaigns">Campanhas em lote ({assets.campaigns.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="forms">
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
                inheritedFromCampaignIds: f.inheritedFromCampaignIds,
              }))}
            />
          </TabsContent>
          <TabsContent value="ads">
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
                inheritedFromCampaignId: ad.inheritedFromCampaignId,
              }))}
            />
          </TabsContent>
          <TabsContent value="campaigns">
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
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
