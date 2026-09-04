"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowRight,
  ChartNoAxesCombined,
  CircleAlert,
  CircleDollarSign,
  Goal,
  Headphones,
  Layers3,
  UsersRound,
} from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { StatCard } from "@/components/dashboard/metric-card";
import { PeriodSelect } from "@/components/period-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PeriodValue } from "@/shared/period";
import type { ExecutiveDashboardData } from "../executive-dashboard-data";

const executiveTabs = [
  { label: "Visão geral", href: "/dashboard", active: true, icon: ChartNoAxesCombined },
  { label: "Leads", href: "/relatorios?tab=commercial", icon: Layers3 },
  { label: "Atendimento", href: "/conversas", icon: Headphones },
  { label: "Conversão", href: "/relatorios?tab=commercial", icon: Goal },
  { label: "Equipe", href: "/relatorios?tab=team", icon: UsersRound },
  { label: "Financeiro", href: "/relatorios?tab=financial", icon: CircleDollarSign },
] as const;

function percentage(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value) + "%";
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortDate(date: unknown) {
  if (typeof date !== "string" && typeof date !== "number") return "";
  const str = String(date);
  if (!str) return "";
  const d = new Date(`${str}T12:00:00`);
  if (isNaN(d.getTime())) return str;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
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
  const { commercial, funnel, attention, units, team, timeline, includeFinancial } = data;
  const roleCopy = {
    director: { title: "Visão executiva", subtitle: "Decisão e acompanhamento da operação", scope: "Toda a operação autorizada" },
    manager: { title: "Painel da unidade", subtitle: "Acompanhamento da sua unidade e equipe", scope: "Sua unidade atribuída" },
    supervisor: { title: "Painel da equipe", subtitle: "Acompanhamento dos corretores supervisionados", scope: "Sua equipe atribuída" },
  }[role];
  const visibleTabs = executiveTabs.filter((tab) => {
    if (tab.label === "Financeiro") return includeFinancial;
    if (tab.label === "Leads" && role === "supervisor") return false;
    return true;
  });
  const primaryKpis = [
    {
      label: "Leads recebidos",
      value: commercial.conversion.received,
      change: `${commercial.previousConversion.received} no período anterior`,
      icon: Layers3,
      iconClassName: "bg-chart-1/10 text-chart-1",
    },
    {
      label: "Taxa de conversão",
      value: percentage(commercial.conversion.rate),
      change: `${commercial.conversion.converted} convertidos`,
      icon: Goal,
      iconClassName: "bg-success/10 text-success",
    },
    {
      label: "Vendas registradas",
      value: commercial.sales,
      change: `${commercial.previousSales} no período anterior`,
      icon: ChartNoAxesCombined,
      iconClassName: "bg-chart-4/10 text-chart-4",
    },
    includeFinancial
      ? {
          label: "Receita bruta",
          value: currency(commercial.revenue ?? 0),
          change: `Ticket médio ${currency(commercial.avgTicket ?? 0)}`,
          icon: CircleDollarSign,
          iconClassName: "bg-chart-2/10 text-chart-2",
        }
      : {
          label: "Leads perdidos",
          value: commercial.conversion.lost,
          change: `${percentage((commercial.conversion.lost / Math.max(commercial.conversion.received, 1)) * 100)} da coorte`,
          icon: CircleAlert,
          iconClassName: "bg-warning/10 text-warning",
        },
  ];

  return (
    <>
      <DashboardHeader
        breadcrumb="Visão geral"
        title={roleCopy.title}
        rightSlot={<PeriodSelect value={period} label="Período do painel executivo" />}
      />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="space-y-4" aria-labelledby="executive-dashboard-title">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{roleCopy.subtitle}</p>
              <h1 id="executive-dashboard-title" className="mt-1 text-2xl font-semibold tracking-tight">
                {roleCopy.title}
              </h1>
            </div>
              <Button asChild variant="outline" size="sm">
              <Link href={`/relatorios?period=${period}`}>Abrir Central de Relatórios <ArrowRight className="size-4" /></Link>
            </Button>
          </div>

          <nav aria-label="Áreas do painel" className="flex gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:none]">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const href = tab.href === "/dashboard" ? `/dashboard?period=${period}` : `${tab.href}${tab.href.includes("?") ? "&" : "?"}period=${period}`;
              return (
                <Link
                  key={tab.label}
                  href={href}
                  aria-current={"active" in tab && tab.active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    "active" in tab && tab.active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </section>

        <section aria-label="Indicadores principais" className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-4">
          {primaryKpis.map((kpi) => <StatCard key={kpi.label} {...kpi} variant="overview" />)}
        </section>

        <p className="-mt-3 text-xs text-muted-foreground">Escopo aplicado: {roleCopy.scope}.</p>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.85fr)]">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Entradas e conversões</CardTitle>
                <CardDescription>Coorte criada nos últimos {period} dias.</CardDescription>
              </div>
              <Badge variant="secondary">Atualizado ao carregar</Badge>
            </CardHeader>
            <CardContent>
              <div className="h-72" aria-label="Gráfico de entradas e conversões por dia">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="received" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="converted" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={28} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <Tooltip labelFormatter={shortDate} />
                    <Area type="monotone" dataKey="received" name="Leads recebidos" stroke="var(--chart-1)" fill="url(#received)" strokeWidth={2} />
                    <Area type="monotone" dataKey="converted" name="Convertidos" stroke="var(--chart-2)" fill="url(#converted)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>O que exige atenção</CardTitle>
              <CardDescription>Alertas calculados com os parâmetros operacionais do tenant.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {attention.items.map((item) => (
                <Link key={item.id} href={item.href} className="group flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium group-hover:text-primary">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                  <Badge variant={item.count > 0 ? "warning" : "secondary"} className="shrink-0 tabular-nums">{item.count}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Funil comercial</CardTitle>
              <CardDescription>Estágios canônicos dos leads recebidos no período.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnel.rows.map((row) => (
                <div key={row.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{row.stage}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{row.inStage}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (row.reached / Math.max(funnel.received, 1)) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Desempenho por unidade</CardTitle>
                <CardDescription>Comparativo dentro do escopo autorizado.</CardDescription>
              </div>
              {units.length > 0 ? <Button asChild variant="ghost" size="sm"><Link href={`/relatorios?tab=units&period=${period}`}>Ver todas</Link></Button> : null}
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 pb-0">
              {units.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Não há unidades com leads no período selecionado.</p>
              ) : (
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="border-y bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Unidade</th><th className="px-4 py-3 text-right font-medium">Leads</th><th className="px-4 py-3 text-right font-medium">Conversão</th><th className="px-6 py-3 text-right font-medium">SLA</th></tr></thead>
                  <tbody>
                    {units.slice(0, 6).map((unit) => <tr key={unit.branchId} className="border-b last:border-0"><td className="px-6 py-3 font-medium">{unit.branchName}</td><td className="px-4 py-3 text-right tabular-nums">{unit.leads}</td><td className="px-4 py-3 text-right tabular-nums">{percentage(unit.conversionRate)}</td><td className="px-6 py-3 text-right tabular-nums">{percentage(unit.slaRate)}</td></tr>)}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle>Desempenho da equipe</CardTitle>
                <CardDescription>Corretores visíveis dentro do seu escopo autorizado.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm"><Link href={`/relatorios?tab=team&period=${period}`}>Ver equipe</Link></Button>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 pb-0">
              {team.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">Não há corretores com leads no período selecionado.</p>
              ) : (
                <table className="w-full min-w-[38rem] text-left text-sm">
                  <thead className="border-y bg-muted/30 text-xs text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Corretor</th><th className="px-4 py-3 text-right font-medium">Recebidos</th><th className="px-4 py-3 text-right font-medium">Trabalhados</th><th className="px-4 py-3 text-right font-medium">Conversão</th><th className="px-6 py-3 text-right font-medium">SLA</th></tr></thead>
                  <tbody>{team.slice(0, 6).map((broker) => <tr key={broker.brokerId} className="border-b last:border-0"><td className="px-6 py-3 font-medium">{broker.brokerName}</td><td className="px-4 py-3 text-right tabular-nums">{broker.received}</td><td className="px-4 py-3 text-right tabular-nums">{broker.worked}</td><td className="px-4 py-3 text-right tabular-nums">{percentage(broker.conversionRate)}</td><td className="px-6 py-3 text-right tabular-nums">{percentage(broker.slaRate)}</td></tr>)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
