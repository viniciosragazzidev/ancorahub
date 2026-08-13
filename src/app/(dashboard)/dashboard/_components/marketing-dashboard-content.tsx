"use client";

import Link from "next/link";
import { Megaphone, ArrowUpRight, ChartBar, CheckCircle, Lightning, SlidersHorizontal, Users, UserList, Redistribute, FileArrowDown } from "@/components/huge-icons";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/metric-card";
import { PeriodSelect } from "@/components/period-select";
import { DEFAULT_PERIOD, type PeriodValue } from "@/shared/period";
import type { MarketingDashboardData } from "../data";

export default function MarketingDashboardContent({
  data,
  period = DEFAULT_PERIOD,
}: {
  data: MarketingDashboardData;
  period?: PeriodValue;
}) {
  const sparklineLeads = data.trend.map((t) => t.leads);
  const sparklineConverted = data.trend.map((t) => t.converted);

  const qualificationRate = data.totals.leadsTotal > 0
    ? `${((data.totals.qualifiedLeads / data.totals.leadsTotal) * 100).toFixed(1)}%`
    : "0,0%";

  return (
    <>
      <DashboardHeader
        breadcrumb={data.tenant.name}
        title="Painel de Marketing"
        rightSlot={<PeriodSelect value={period} />}
      />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6 bg-background">
        {/* Banner de Boas-vindas */}
        <section aria-labelledby="marketing-welcome" className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/[0.03] to-background p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="indigo" className="gap-1 px-2.5 py-0.5">
                  <Megaphone className="size-3.5 text-primary" /> Painel Marketing
                </Badge>
                {data.totals.unroutedCampaigns > 0 && (
                  <Badge variant="warning" className="gap-1 px-2.5 py-0.5">
                    {data.totals.unroutedCampaigns} campanha(s) sem fila
                  </Badge>
                )}
              </div>
              <h1 id="marketing-welcome" className="text-xl font-semibold tracking-tight">
                Visão de Tráfego & Captação de Leads
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Acompanhe o volume de captação, conversão comercial das campanhas Meta Ads e o roteamento de leads para as equipes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <Button render={<Link href="/marketing/campanhas" />} size="sm">
                <Megaphone className="size-4" /> Gerenciar Campanhas
              </Button>
              <Button render={<Link href="/leads/distribuicao?view=filas" />} variant="outline" size="sm">
                <Redistribute className="size-4" /> Regras de Filas
              </Button>
            </div>
          </div>
        </section>

        {/* Mapeamento de Métricas Chave */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Leads de Marketing"
            value={data.totals.leadsTotal}
            sublabel={`${data.totals.convertedLeads} convertidos em vendas`}
            sparklineData={sparklineLeads}
            sparklineColor="var(--chart-1)"
          />
          <StatCard
            label="Taxa de Qualificação"
            value={qualificationRate}
            sublabel={`${data.totals.qualifiedLeads} leads avançaram no funil`}
            sparklineData={sparklineConverted}
            sparklineColor="var(--chart-3)"
          />
          <StatCard
            label="Campanhas Meta Ads"
            value={data.totals.activeCampaigns}
            sublabel={`de ${data.totals.metaCampaigns} campanhas sincronizadas`}
            sparklineData={sparklineLeads}
            sparklineColor="var(--chart-4)"
          />
          <StatCard
            label="Anúncios Veiculados"
            value={data.totals.activeAds}
            sublabel={`de ${data.totals.metaAds} anúncios cadastrados`}
            sparklineData={sparklineConverted}
            sparklineColor="var(--chart-2)"
          />
        </div>

        {/* Layout Principal: 2 Colunas */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda: Origens e Tendência (7 colunas) */}
          <div className="space-y-6 lg:col-span-7">
            {/* Gráfico de Tendência de Captação */}
            <Card variant="compact">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base">Evolução Diária de Leads</CardTitle>
                  <CardDescription>Captação diária e conversões comerciais acumuladas.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(val) => String(val).slice(5)} textAnchor="end" />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", borderRadius: "8px" }}
                        formatter={(val, name) => [val, name === "leads" ? "Leads Captação" : "Convertidos"]}
                      />
                      <Area type="monotone" dataKey="leads" stroke="var(--chart-1)" fillOpacity={1} fill="url(#colorLeads)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Origens de Entrada */}
            <Card variant="compact">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Origens & Canais de Captação</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {data.sources.length} canal(is)
                  </Badge>
                </CardTitle>
                <CardDescription>Distribuição proporcional das fontes de entrada registradas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.sources.length ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma origem registrada neste período.</p>
                ) : (
                  data.sources.map((src) => (
                    <div key={src.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="truncate">{src.name}</span>
                        <span className="font-mono text-muted-foreground">{src.count} lead(s) · {src.percentage}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className="h-full rounded-full bg-primary/80 transition-all duration-300"
                          style={{ width: src.percentage }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita: Campanhas Meta e Ações (5 colunas) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Campanhas Meta & Roteamento */}
            <Card variant="compact">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Megaphone className="size-4 text-primary" /> Campanhas Meta Ads
                  </CardTitle>
                  <CardDescription>Destino e filas configuradas por campanha.</CardDescription>
                </div>
                <Button render={<Link href="/marketing/campanhas" />} size="xs" variant="ghost">
                  Ver todas <ArrowUpRight className="size-3" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {!data.campaigns.length ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">Nenhuma campanha Meta sincronizada.</p>
                    <Button render={<Link href="/integrations" />} size="xs" variant="outline">
                      Conectar Meta Ads
                    </Button>
                  </div>
                ) : (
                  data.campaigns.slice(0, 5).map((camp) => (
                    <div key={camp.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card p-2.5 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{camp.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <span className={camp.status === "ACTIVE" ? "text-success font-semibold" : ""}>{camp.status === "ACTIVE" ? "● Ativa" : "○ Pausada"}</span>
                          <span>· {camp.leadsCount} lead(s)</span>
                        </p>
                      </div>
                      <Badge variant={camp.queueName === "Sem entrada" ? "outline" : "indigo"} className="text-[10px] shrink-0">
                        {camp.queueName}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Funil Comercial Visual */}
            <Card variant="compact">
              <CardHeader>
                <CardTitle className="text-base">Aproveitamento Comercial</CardTitle>
                <CardDescription>Evolução dos leads captados pelo tráfego até o fechamento.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.funnel.map((item) => (
                    <div key={item.stage} className="flex items-center justify-between text-xs rounded-md bg-muted/40 px-3 py-2">
                      <span className="font-medium">{item.stage}</span>
                      <span className="font-mono text-primary font-semibold tabular-nums">{item.volume}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ações Rápidas de Marketing */}
            <Card variant="compact" className="border-primary/15 bg-primary/[0.02]">
              <CardHeader>
                <CardTitle className="text-sm">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button render={<Link href="/marketing/campanhas" />} variant="outline" size="sm" className="justify-start gap-2">
                  <Megaphone className="size-4 text-primary" /> Vincular Fila por Campanha
                </Button>
                <Button render={<Link href="/leads/distribuicao?view=filas" />} variant="outline" size="sm" className="justify-start gap-2">
                  <Redistribute className="size-4 text-primary" /> Central de Filas & Roteamento
                </Button>
                <Button render={<Link href="/marketing/importacoes" />} variant="outline" size="sm" className="justify-start gap-2">
                  <FileArrowDown className="size-4 text-primary" /> Importar Leads via CSV
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
