"use client";

import { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDownIcon, ChevronRightIcon, ChartBar, CheckCircle, Lightning, MagnifyingGlass, Phone, Users, Megaphone, Buildings } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/features/quotes/utils";
import type { MetaCampaignItem } from "../types";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleMetaCampaignCaptureEligibilityAction } from "../actions";

export function CampaignsDashboardView({
  campaigns,
  totals,
}: {
  campaigns: MetaCampaignItem[];
  totals: {
    leads: number;
    conversations: number;
    sales: number;
    revenue: number;
    conversionRate: number;
  };
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleExpand = (campaignId: string) => {
    setExpandedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const handleToggleEligibility = async (campaignId: string, currentEnabled: boolean) => {
    setTogglingId(campaignId);
    try {
      const res = await toggleMetaCampaignCaptureEligibilityAction({
        campaignId,
        enabled: !currentEnabled,
      });
      if (res.success) {
        toast.success(!currentEnabled ? "Campanha ativada para captura no CRM!" : "Captura desativada para esta campanha.");
        router.refresh();
      } else {
        toast.error(res.error || "Erro ao atualizar elegibilidade da campanha.");
      }
    } finally {
      setTogglingId(null);
    }
  };

  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((campaign) => campaign.status.trim().toUpperCase() === "ACTIVE" || (campaign.conversationsCount || 0) > 0)
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase().trim()))
      .sort((a, b) => {
        const aEligible = a.isEligibleForCapture ? 1 : 0;
        const bEligible = b.isEligibleForCapture ? 1 : 0;
        if (bEligible !== aEligible) return bEligible - aEligible;
        return (b.leadsCount || 0) - (a.leadsCount || 0);
      });
  }, [campaigns, search]);

  // Agrupamento de campanhas por Conta de Anúncios
  const groupedByAdAccount = useMemo(() => {
    const groups = new Map<string, { accountId: string; accountName: string; campaigns: MetaCampaignItem[] }>();
    for (const camp of filteredCampaigns) {
      const accKey = camp.adAccountId || "default";
      const accName = camp.adAccountName || `Conta de Anúncios ${accKey}`;
      const group = groups.get(accKey) || { accountId: accKey, accountName: accName, campaigns: [] };
      group.campaigns.push(camp);
      groups.set(accKey, group);
    }
    return Array.from(groups.values());
  }, [filteredCampaigns]);

  return (
    <div className="space-y-6">
      {/* ─── INDICADORES GERAIS DE MARKETING & VENDAS ─── */}
      <section aria-label="Métricas de marketing" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Leads Capturados", value: totals.leads, color: "text-chart-1", bg: "bg-chart-1/10", icon: Users },
          { label: "Leads em atendimento", value: totals.conversations, color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Phone },
          { label: "Vendas Concluídas", value: totals.sales, color: "text-chart-5", bg: "bg-chart-5/10", icon: CheckCircle },
          { label: "Taxa de Conversão", value: `${totals.conversionRate}%`, color: "text-chart-2", bg: "bg-chart-2/10", icon: ChartBar },
          { label: "Receita Gerada", value: formatCurrency(totals.revenue, { maximumFractionDigits: 0 }), color: "text-primary", bg: "bg-primary/10", icon: Lightning },
          { label: "Campanhas Ativas", value: campaigns.filter((c) => c.status === "ACTIVE" || c.status === "active").length, color: "text-chart-3", bg: "bg-chart-3/10", icon: Lightning },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-border/60 bg-card p-4 text-left shadow-none">
              <div className="flex items-center justify-between gap-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">Meta Ads</span>
              </div>
              <div className="mt-3 space-y-1">
                <p className={`text-xl font-bold tabular-nums tracking-tight ${item.color}`}>{item.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              </div>
            </div>
          );
        })}
      </section>

      {/* ─── TABELA DE CAMPANHAS AGRUPADA POR CONTA DE ANÚNCIOS ─── */}
      <Card className="rounded-2xl border-0 shadow-none bg-card/40 dark:bg-card/60 p-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 p-3.5 sm:px-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Megaphone className="size-5 text-primary" /> Desempenho por Conta de Anúncios, Campanha & Anúncio
            </CardTitle>
            <CardDescription className="text-xs">
              Campanhas ativas e campanhas pausadas com leads ativos em atendimento, agrupadas por conta de anúncios.
            </CardDescription>
          </div>
          <div className="relative w-64">
            <MagnifyingGlass className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 bg-muted pl-8 text-xs"
              placeholder="Buscar campanha..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groupedByAdAccount.map((group) => (
            <div key={group.accountName} className="border-b border-border/40 last:border-b-0">
              {/* Header da Conta de Anúncios com Tags de Identificação */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <Buildings className="size-4 text-primary" />
                  <span className="text-xs font-bold text-foreground tracking-wide">{group.accountName}</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-background/50">
                    ID Conta: {group.accountId}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {group.campaigns.length} {group.campaigns.length === 1 ? "campanha" : "campanhas"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                  <span>Leads: <strong className="text-foreground">{group.campaigns.reduce((sum, c) => sum + (c.leadsCount || 0), 0)}</strong></span>
                  <span>Vendas: <strong className="text-emerald-600 dark:text-emerald-400">{group.campaigns.reduce((sum, c) => sum + (c.salesCount || 0), 0)}</strong></span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 border-b border-border/30">
                    <TableHead className="w-10 pl-4"></TableHead>
                    <TableHead className="text-xs font-semibold">Campanha Meta & Tags de Identificação</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Leads</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Em atendimento</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Vendas</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Receita Vendida</TableHead>
                    <TableHead className="text-right text-xs font-semibold">Conversão %</TableHead>
                    <TableHead className="pr-4 text-right text-xs font-semibold">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.campaigns.map((camp) => {
                    const isExpanded = expandedCampaignIds.has(camp.id);
                    const hasAds = (camp.ads?.length ?? 0) > 0;
                    return (
                      <Fragment key={camp.id}>
                        <TableRow className="hover:bg-muted/30 transition-colors">
                          <TableCell className="pl-4 py-2.5">
                            {hasAds && (
                              <button
                                type="button"
                                onClick={() => toggleExpand(camp.id)}
                                className="grid size-6 place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title={isExpanded ? "Ocultar anúncios" : "Ver anúncios"}
                              >
                                {isExpanded ? <ChevronDownIcon className="size-4 text-primary" /> : <ChevronRightIcon className="size-4" />}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs text-foreground">{camp.name}</span>
                                {hasAds && (
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-normal">
                                    {camp.ads!.length} {camp.ads!.length === 1 ? "anúncio" : "anúncios"}
                                  </Badge>
                                )}
                                {camp.isEligibleForCapture ? (
                                  <Badge variant="success" className="text-[9px] h-4 px-1.5 font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40">
                                    ✓ Captura Ativa
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
                                    ✕ Ignorar Leads
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground bg-muted/20">
                                  ID Campanha: {camp.campaignId}
                                </Badge>
                                <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground bg-muted/20">
                                  Objetivo: {camp.objective || "LEAD_GENERATION"}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="py-2.5">
                            <Badge variant={camp.status === "ACTIVE" || camp.status === "active" ? "success" : "outline"} className="text-[10px]">
                              {camp.status === "ACTIVE" || camp.status === "active" ? "Ativa" : "Pausada"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium tabular-nums py-2.5">{camp.leadsCount || 0}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium tabular-nums py-2.5">{camp.conversationsCount || 0}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums py-2.5">{camp.salesCount || 0}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-foreground tabular-nums py-2.5">
                            {formatCurrency(camp.revenueTotal || 0, { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-chart-2 tabular-nums py-2.5">{camp.conversionRate || 0}%</TableCell>
                          <TableCell className="pr-4 text-right py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant={camp.isEligibleForCapture ? "outline" : "default"}
                                disabled={togglingId === camp.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleToggleEligibility(camp.campaignId, Boolean(camp.isEligibleForCapture));
                                }}
                                className={cn(
                                  "h-7 text-[11px] px-2 font-medium",
                                  !camp.isEligibleForCapture && "bg-emerald-600 hover:bg-emerald-700 text-white"
                                )}
                              >
                                {togglingId === camp.id ? "…" : camp.isEligibleForCapture ? "Desativar Captura" : "Capturar Leads"}
                              </Button>
                              <Link
                                href={`/marketing/campanhas/${encodeURIComponent(camp.id || camp.campaignId)}`}
                                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs px-2 gap-1")}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Detalhes <ArrowRight className="size-3.5" />
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Sub-tabela expansível de Anúncios da Campanha com Tags de Identificação */}
                        {isExpanded && hasAds && (
                          <TableRow className="bg-muted/15 hover:bg-muted/20">
                            <TableCell colSpan={9} className="p-0 pl-12 pr-4 py-3">
                              <div className="rounded-lg border border-border/50 bg-background/80 p-3 space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                  <Megaphone className="size-3.5 text-primary" /> Anúncios vinculados com tags de identificação:
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {camp.ads!.map((ad) => (
                                    <div key={ad.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-card p-2.5 text-xs">
                                      <div className="min-w-0 space-y-1">
                                        <p className="font-medium truncate text-foreground text-xs">{ad.name}</p>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Badge variant={ad.status === "ACTIVE" || ad.status === "active" ? "success" : "outline"} className="text-[9px] px-1 py-0 h-4">
                                            {ad.status === "ACTIVE" || ad.status === "active" ? "Ativo" : "Pausado"}
                                          </Badge>
                                          <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground px-1 py-0 h-4">
                                            ID Anúncio: {ad.adId}
                                          </Badge>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-[10px] font-mono text-muted-foreground block">Leads</span>
                                        <span className="font-mono font-bold text-xs text-primary">{ad.leadsCount || 0}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}

          {filteredCampaigns.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhuma campanha ativa encontrada para esta busca. Sincronize a Meta ou ajuste o termo pesquisado.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
