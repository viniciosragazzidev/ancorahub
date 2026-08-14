"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, ChartBar, CheckCircle, Lightning, MagnifyingGlass, Phone, Users } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/features/quotes/utils";
import type { MetaCampaignItem } from "../types";

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
  const [search, setSearch] = useState("");

  const filteredCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase().trim()))
      .sort((a, b) => {
        const aActive = a.status === "ACTIVE" || a.status === "active";
        const bActive = b.status === "ACTIVE" || b.status === "active";
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return (b.leadsCount || 0) - (a.leadsCount || 0);
      });
  }, [campaigns, search]);

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

      {/* ─── TABELA DE CAMPANHAS ─── */}
      <Card className="rounded-2xl border-0 shadow-none bg-card/40 dark:bg-card/60 p-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50 p-3.5 sm:px-4">
          <div>
            <CardTitle className="text-base font-bold">Desempenho Comercial por Campanha</CardTitle>
            <CardDescription className="text-xs">
              Relação direta do investimento de marketing com leads, conversas, propostas e receita vendida.
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
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="pl-4 text-xs font-semibold">Campanha</TableHead>
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
              {filteredCampaigns.map((camp) => (
                <TableRow key={camp.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="pl-4 py-2.5">
                    <p className="font-semibold text-xs text-foreground">{camp.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{camp.objective || "LEAD_GENERATION"}</p>
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
                    <Button render={<Link href={`/marketing/campanhas/${camp.id}`} />} size="sm" variant="ghost" className="h-8 text-xs gap-1">
                      Detalhes <ArrowRight className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredCampaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-8 text-center text-xs text-muted-foreground">
                    Nenhuma campanha encontrada. Conecte sua conta Meta ou ajuste o filtro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
