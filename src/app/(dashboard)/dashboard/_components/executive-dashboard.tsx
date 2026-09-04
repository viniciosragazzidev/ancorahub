"use client";

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
    <Card>
      <CardHeader>
        <CardTitle>Entradas e conversões</CardTitle>
        <CardDescription>Coorte criada nos últimos {period} dias.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72" aria-label="Gráfico de entradas e conversões por dia">
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

export function ExecutiveDashboard({
  data,
  period,
  role,
}: {
  data: ExecutiveDashboardData;
  period: PeriodValue;
  role: "director" | "manager" | "supervisor";
}) {
  const roleCopy = {
    director: { title: "Visão executiva", subtitle: "Decisão e acompanhamento da operação" },
    manager: { title: "Painel da unidade", subtitle: "Acompanhamento da sua unidade e equipe" },
    supervisor: { title: "Painel da equipe", subtitle: "Acompanhamento dos corretores supervisionados" },
  }[role];
  const tabs: PageTabItem[] = data.tabs.map((tab) => ({
    id: tab,
    label: REPORT_TAB_LABELS[tab],
    icon: TAB_ICONS[tab],
  }));

  return (
    <>
      <DashboardHeader
        breadcrumb="Painel"
        title={roleCopy.title}
        rightSlot={<PeriodSelect value={period} label="Período do painel" />}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:p-6">
        <section aria-labelledby="executive-dashboard-title" className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{roleCopy.subtitle}</p>
            <h1 id="executive-dashboard-title" className="mt-1 text-2xl font-semibold tracking-tight">
              {REPORT_TAB_LABELS[data.activeTab]}
            </h1>
          </div>
          <PageTabs tabs={tabs} active={data.activeTab} hrefBuilder={(tab) => `/dashboard?tab=${tab}&period=${period}`} />
        </section>

        {data.activeTab === "overview" && "commercial" in data && "timeline" in data && "funnel" in data && "attention" in data && (
          <div className="space-y-6">
            <ExecutiveTimeline data={[...data.timeline]} period={period} />
            <OverviewTab period={period} commercial={data.commercial} funnel={data.funnel} attention={data.attention} />
          </div>
        )}
        {data.activeTab === "commercial" && "commercial" in data && "funnel" in data && "attention" in data && "sourcePerformance" in data && (
          <CommercialTab period={period} overview={data.commercial} funnel={data.funnel} attention={data.attention} sourcePerformance={data.sourcePerformance} />
        )}
        {data.activeTab === "team" && "teamPerformance" in data && (
          <TeamTab period={period} teamPerformance={data.teamPerformance} />
        )}
        {data.activeTab === "units" && "units" in data && <UnitsTab period={period} units={data.units} />}
        {data.activeTab === "financial" && "financial" in data && <FinancialTab period={period} financial={data.financial} />}
      </main>
    </>
  );
}
