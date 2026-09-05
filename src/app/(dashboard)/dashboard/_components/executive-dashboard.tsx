"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartNoAxesCombined, CircleDollarSign, Layers3, UsersRound } from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { PageTabs, type PageTabItem } from "@/components/foundations/page-tabs";
import { PeriodSelect } from "@/components/period-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { REPORT_TAB_LABELS, type ReportTabId } from "@/features/reports/metrics/metric-catalog";
import type { PeriodValue } from "@/shared/period";
import type { ExecutiveDashboardData } from "../executive-dashboard-data";
import { CommercialTab } from "../../relatorios/_components/commercial-tab";
import { FinancialTab } from "../../relatorios/_components/financial-tab";
import { OverviewTab } from "../../relatorios/_components/overview-tab";
import { TeamTab } from "../../relatorios/_components/team-tab";
import { UnitsTab } from "../../relatorios/_components/units-tab";

const TAB_ICONS: Record<ReportTabId, PageTabItem["icon"]> = {
  overview: ChartNoAxesCombined,
  commercial: Layers3,
  team: UsersRound,
  units: Layers3,
  financial: CircleDollarSign,
};

function shortDate(date: unknown) {
  const value = typeof date === "string" || typeof date === "number" ? String(date) : "";
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(parsed);
}

function ExecutiveTimeline({
  data,
  period,
}: {
  data: { date: string; received: number; converted: number }[];
  period: PeriodValue;
}) {
  return (
    <Card className="shadow-none border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Entradas e conversões</CardTitle>
        <CardDescription className="text-xs">Coorte criada nos últimos {period} dias.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-44 sm:h-48" aria-label="Gráfico de entradas e conversões por dia">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboard-received" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashboard-converted" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={shortDate} />
              <Area type="monotone" dataKey="received" name="Leads recebidos" stroke="var(--chart-1)" fill="url(#dashboard-received)" strokeWidth={2} />
              <Area type="monotone" dataKey="converted" name="Convertidos" stroke="var(--chart-2)" fill="url(#dashboard-converted)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

function DashboardTabLoadingSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Main Chart/Section Skeleton */}
      <div className="rounded-xl border border-border/50 bg-card/60 p-5 sm:p-6 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-44 sm:h-52 w-full rounded-lg" />
      </div>

      {/* Secondary Split Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border/50 bg-card/60 p-5 sm:p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2.5">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-5 sm:p-6 space-y-4">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2.5">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExecutiveDashboard({
  data,
  period,
  role,
}: {
  data: ExecutiveDashboardData;
  period: PeriodValue;
  role: "director" | "manager" | "supervisor";
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTabId>(data.activeTab);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setActiveTab(data.activeTab);
  }, [data.activeTab]);

  const handleTabChange = (tabId: string) => {
    const nextTab = tabId as ReportTabId;
    setActiveTab(nextTab);
    startTransition(() => {
      router.replace(`/dashboard?tab=${nextTab}&period=${period}`, { scroll: false });
    });
  };

  const roleCopy = {
    director: { title: "Visão Executiva", subtitle: "Decisão e acompanhamento de ponta a ponta da operação comercial" },
    manager: { title: "Painel da Unidade", subtitle: "Acompanhamento de metas, corretores e resultados da sua unidade" },
    supervisor: { title: "Painel da Equipe", subtitle: "Acompanhamento operacional e conversão dos corretores supervisionados" },
  }[role];

  const tabs: PageTabItem[] = data.tabs.map((tab) => ({
    id: tab,
    label: REPORT_TAB_LABELS[tab],
    icon: TAB_ICONS[tab],
  }));

  const effectiveTab = activeTab;

  const isTabReady =
    (effectiveTab === "overview" && "commercial" in data && "timeline" in data && "funnel" in data && "attention" in data) ||
    (effectiveTab === "commercial" && "commercial" in data && "funnel" in data && "attention" in data && "sourcePerformance" in data) ||
    (effectiveTab === "team" && "teamPerformance" in data) ||
    (effectiveTab === "units" && "units" in data) ||
    (effectiveTab === "financial" && "financial" in data);

  return (
    <>
      <DashboardHeader
        breadcrumb="Painel"
        title={roleCopy.title}
        rightSlot={<PeriodSelect value={period} label="Período do painel" />}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <section aria-labelledby="executive-dashboard-title" className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 id="executive-dashboard-title" className="text-2xl font-bold tracking-tight text-foreground">
                {REPORT_TAB_LABELS[effectiveTab]}
              </h1>
              <p className="text-sm text-muted-foreground">{roleCopy.subtitle}</p>
            </div>
          </div>
          <div className="space-y-2">
            <PageTabs
              tabs={tabs}
              active={effectiveTab}
              onTabChange={handleTabChange}
            />
            {isPending && (
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full animate-pulse bg-primary/70" />
              </div>
            )}
          </div>
        </section>

        <div className={isPending && isTabReady ? "opacity-75 transition-opacity duration-150 pointer-events-none" : ""}>
          {!isTabReady ? (
            <DashboardTabLoadingSkeleton />
          ) : (
            <>
              {effectiveTab === "overview" && "commercial" in data && "timeline" in data && "funnel" in data && "attention" in data && (
                <div className="space-y-6 sm:space-y-8">
                  <ExecutiveTimeline data={[...data.timeline]} period={period} />
                  <OverviewTab period={period} commercial={data.commercial} funnel={data.funnel} attention={data.attention} />
                </div>
              )}
              {effectiveTab === "commercial" && "commercial" in data && "funnel" in data && "attention" in data && "sourcePerformance" in data && (
                <div className="space-y-6 sm:space-y-8">
                  <CommercialTab period={period} overview={data.commercial} funnel={data.funnel} attention={data.attention} sourcePerformance={data.sourcePerformance} />
                </div>
              )}
              {effectiveTab === "team" && "teamPerformance" in data && (
                <div className="space-y-6 sm:space-y-8">
                  <TeamTab period={period} teamPerformance={data.teamPerformance} />
                </div>
              )}
              {effectiveTab === "units" && "units" in data && (
                <div className="space-y-6 sm:space-y-8">
                  <UnitsTab period={period} units={data.units} />
                </div>
              )}
              {effectiveTab === "financial" && "financial" in data && (
                <div className="space-y-6 sm:space-y-8">
                  <FinancialTab period={period} financial={data.financial} />
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
