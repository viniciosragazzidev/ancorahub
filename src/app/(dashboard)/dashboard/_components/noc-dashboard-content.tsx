"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ChartBar,
  CheckCircle,
  Circle,
  Globe,
  SealCheck,
  Users,
  UserList,
  Warning,
  WifiHigh,
  XCircle,
} from "@/components/huge-icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DashboardHeader } from "@/components/dashboard-header";
import { LeadStatusBadge } from "@/components/status-badges";
import { NocHeaderSlot } from "@/app/(dashboard)/noc/noc-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatCard } from "@/components/dashboard/metric-card";
import type {
  DirectorDashboardData,
  ManagerDashboardData,
  BrokerDashboardData,
} from "../data";

// ─── Props ──────────────────────────────────────────────────────────────────

type RoleProps =
  | { role: "director"; data: DirectorDashboardData }
  | { role: "manager"; data: ManagerDashboardData }
  | { role: "broker"; data: BrokerDashboardData };

// ─── Status Helper ───────────────────────────────────────────────────────────

function StatusIndicator({
  status,
}: {
  status: "operational" | "degraded" | "down";
}) {
  if (status === "operational")
    return <SealCheck className="size-4 text-success" weight="fill" />;
  if (status === "degraded")
    return <Warning className="size-4 text-warning" weight="fill" />;
  return <XCircle className="size-4 text-destructive" weight="fill" />;
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "conversion":
      return (
        <CheckCircle className="size-3.5 text-success" weight="fill" />
      );
    case "new_lead":
      return <Users className="size-3.5 text-chart-3" weight="fill" />;
    case "alert":
      return <Warning className="size-3.5 text-warning" weight="fill" />;
    default:
      return (
        <Circle className="size-3.5 text-muted-foreground" weight="fill" />
      );
  }
}

function DirectorActionCenter({ data }: { data: DirectorDashboardData }) {
  const actions = [
    {
      label: "Leads sem contato",
      value: data.totals.unworked,
      description: "Distribuídos há mais de 15 min",
      href: "/leads?attention=unworked",
      badge: data.totals.unworked > 0 ? "Crítico" : "Ok",
      badgeTone: data.totals.unworked > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      icon: Warning,
    },
    {
      label: "Leads estagnados",
      value: data.totals.stalled,
      description: "Sem avanço há 3+ dias",
      href: "/leads?attention=stalled",
      badge: data.totals.stalled > 0 ? "Atenção" : "Ok",
      badgeTone: data.totals.stalled > 0 ? "bg-red-500/10 text-red-600 border-red-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      icon: XCircle,
    },
    {
      label: "Equipe ativa",
      value: `${data.totals.activeBrokers}/${data.totals.members}`,
      description: "Corretores na operação",
      href: "/equipe",
      badge: "Equipe",
      badgeTone: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      icon: Users,
    },
    {
      label: "Parâmetros do Tenant",
      value: "OK",
      description: "Integrações & Segurança",
      href: "/settings",
      badge: "Sistema",
      badgeTone: "bg-muted text-muted-foreground border-border",
      icon: Globe,
    },
  ] as const;

  return (
    <section aria-labelledby="director-action-center" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="director-action-center" className="text-sm font-bold tracking-tight">Minha Operação & Pendências</h2>
          <p className="text-xs text-muted-foreground">Monitore pontos que exigem ação rápida do gestor.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="group rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-border-strong hover:bg-card/95 hover:-translate-y-0.5 shadow-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className={`text-[10px] font-mono uppercase ${action.badgeTone}`}>
                  {action.badge}
                </Badge>
                <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <p className="mt-3 text-xs font-semibold text-muted-foreground">{action.label}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-foreground">{action.value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─── Chart Tooltip ───────────────────────────────────────────────────────────

function ChartTooltipWrapper({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p
          key={i}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

function ActivityFeed({
  activities,
}: {
  activities: Array<{
    id: number;
    type: string;
    message: string;
    time: string;
    user: string;
    branchName?: string | null;
  }>;
}) {
  return (
    <Card className="rounded-xl border-border/70 bg-card shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Atividades Recentes</CardTitle>
            <CardDescription>Movimentações da operação</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1.5 rounded-md text-xs">
            <ChartBar className="size-3" weight="fill" />
            Tempo real
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-72 overflow-y-auto">
          <div className="space-y-0">
            {activities.map((activity, i) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 border-b border-border/40 px-6 py-3.5 transition-colors last:border-0 hover:bg-muted/20"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-muted/60">
                  <ActivityIcon type={activity.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{activity.user}</span>
                    {activity.branchName && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-foreground/70">{activity.branchName}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{activity.time}</span>
                  </div>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Nenhuma atividade registrada.
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Director Dashboard ──────────────────────────────────────────────────────

function DirectorNocContent({ data }: { data: DirectorDashboardData }) {
  const funnelChartData = data.funnel.map((f) => ({
    name: f.stage,
    volume: f.volume,
  }));
  const totalLeads = data.totals.leads;
  const totalConverted = data.totals.converted;
  const conversionRate =
    totalLeads > 0
      ? ((totalConverted / totalLeads) * 100).toFixed(1)
      : "0,0";

  const statusDistribution = [
    { name: "Novos", value: data.funnel.find((f) => f.stage === "Novo")?.volume ?? 0, color: "var(--chart-1)" },
    { name: "Contato", value: data.funnel.find((f) => f.stage === "Contato")?.volume ?? 0, color: "var(--chart-2)" },
    { name: "Cotação", value: data.funnel.find((f) => f.stage === "Cotação")?.volume ?? 0, color: "var(--chart-3)" },
    { name: "Negociação", value: data.funnel.find((f) => f.stage === "Negociação")?.volume ?? 0, color: "var(--chart-4)" },
    { name: "Conversão", value: data.funnel.find((f) => f.stage === "Conversão")?.volume ?? 0, color: "var(--chart-5)" },
  ];

  const activities = [
    { id: 1, type: "alert", message: `${data.totals.unworked} leads não trabalhados há mais de 15 min`, time: "agora", user: "Alerta" },
    { id: 2, type: "alert", message: `${data.totals.stalled} leads estagnados sem avanço`, time: "agora", user: "Alerta" },
    { id: 3, type: "conversion", message: `${totalConverted} leads convertidos no total`, time: "hoje", user: "Sistema" },
    ...data.branches.map((b, i) => ({
      id: 10 + i,
      type: "new_lead" as const,
      message: `Filial "${b.name}" — ${b.leads} leads, ${b.conversion} conversão`,
      time: "hoje",
      user: "Sistema",
      branchName: b.name,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* ─── ZONA 1: MINHA FILA & PENDÊNCIAS ─── */}
      <DirectorActionCenter data={data} />

      {/* ─── ZONA 3: PLANTÃO ATUAL (Daily Operation Bar) ─── */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-border-strong">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Badge variant="outline" className="gap-2 rounded-full border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              PLANTÃO AO VIVO
            </Badge>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              <span className="font-bold tabular-nums">{data.totals.activeBrokers} de {data.totals.members}</span> corretores online na escala de distribuição
            </p>
          </div>
          <Button render={<Link href="/leads/distribuicao/plantao" />} size="sm" variant="default" className="h-9 px-4 text-xs font-semibold gap-2 shrink-0">
            <WifiHigh className="size-4" /> Abrir Módulo de Plantão
          </Button>
        </div>
      </Card>

      {/* ─── ZONA 4: INDICADORES (Gráficos Isolados no Final) ─── */}
      <section className="space-y-4 pt-2">
        <div className="border-b border-border/50 pb-2">
          <h2 className="text-sm font-bold tracking-tight">Indicadores & Analytics</h2>
          <p className="text-xs text-muted-foreground">Desempenho do funil e distribuição de conversões.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Leads Totais" value={data.totals.leads} change={`${data.totals.activeLeads} ativos`} sublabel="Carteira do tenant" animated sparklineData={data.trend.map((t) => t.leads)} sparklineColor="var(--chart-1)" />
          <StatCard label="Em Atendimento" value={data.totals.activeLeads} change={`${((data.totals.activeLeads / Math.max(1, data.totals.leads)) * 100).toFixed(0)}%`} sublabel="Leads negociando" animated animationDelay={0.08} sparklineData={data.trend.map((t) => Math.max(0, t.leads - t.converted))} sparklineColor="var(--chart-2)" />
          <StatCard label="Conversões" value={data.totals.converted} change={data.totals.leads > 0 ? `${conversionRate}%` : "0%"} sublabel="Leads finalizados" animated animationDelay={0.16} sparklineData={data.trend.map((t) => t.converted)} sparklineColor="var(--chart-5)" />
          <StatCard label="Corretores" value={data.totals.activeBrokers} change={`${data.totals.members} cadastrados`} sublabel="Equipe comercial" animated animationDelay={0.24} sparklineData={data.trend.map((t, idx) => Math.round(t.leads * (0.3 + (idx % 3) * 0.05)))} sparklineColor="var(--chart-4)" />
        </div>
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Funnel Flow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
          className="lg:col-span-4"
        >
          <Card className="rounded-xl border-border/70 bg-card shadow-none">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Funil Comercial</CardTitle>
                  <CardDescription>
                    Leads por etapa no tenant
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {funnelChartData.map((d) => (
                    <span
                      key={d.name}
                      className="flex items-center gap-1.5"
                    >
                      <span className="inline-block size-2.5 rounded-full bg-primary" />
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart
                    data={funnelChartData}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="funnelGradient"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="name"
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 12,
                      }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{
                        fill: "var(--muted-foreground)",
                        fontSize: 12,
                      }}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltipWrapper />}
                      cursor={{
                        stroke: "var(--border)",
                        strokeDasharray: "3 3",
                      }}
                    />
                    <Area
                      dataKey="volume"
                      fill="url(#funnelGradient)"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      type="monotone"
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.08 }}
          className="lg:col-span-3"
        >
          <Card className="rounded-xl border-border/70 bg-card shadow-none">
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>
                Leads em cada etapa do funil
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-64 items-center justify-center">
                <div className="relative">
                  <ResponsiveContainer height={180} width={220}>
                    <PieChart>
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={statusDistribution.filter((d) => d.value > 0)}
                        dataKey="value"
                        endAngle={-270}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        strokeWidth={0}
                        animationDuration={600}
                        animationEasing="ease-out"
                      >
                        {statusDistribution
                          .filter((d) => d.value > 0)
                          .map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                      </Pie>
                      <Tooltip content={<ChartTooltipWrapper />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold tabular-nums">
                      {totalLeads}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Total
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {statusDistribution
                  .filter((d) => d.value > 0)
                  .map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="inline-block size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-muted-foreground">
                        {item.name}
                      </span>
                      <span className="ml-auto font-medium tabular-nums">
                        {item.value}
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Additional Charts Row: Daily Performance & Branch Breakdown */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Daily Trend (Composed Chart) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.12 }}
          className="lg:col-span-4"
        >
          <Card className="rounded-xl border-border/70 bg-card shadow-none">
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Histórico de Captura vs Conversão</CardTitle>
                  <CardDescription>
                    Evolução nos últimos 30 dias (Leads x Vendas)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-sm bg-chart-1" />
                    Leads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-0.5 w-3 bg-chart-5" />
                    Conversões
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.trend}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => val ? `${val.split('-')[2]}/${val.split('-')[1]}` : ''}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltipWrapper />} cursor={{ fill: "var(--muted)/30" }} />
                    <Bar
                      dataKey="leads"
                      name="Leads Recebidos"
                      fill="var(--chart-1)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      type="monotone"
                      dataKey="converted"
                      name="Conversões"
                      stroke="var(--chart-5)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Branch Performance Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.16 }}
          className="lg:col-span-3"
        >
          <Card className="rounded-xl border-border/70 bg-card shadow-none h-full">
            <CardHeader>
              <CardTitle>Performance por Unidade</CardTitle>
              <CardDescription>
                Volume e conversão entre filiais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={data.branches}
                    margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }}
                      width={100}
                    />
                    <Tooltip content={<ChartTooltipWrapper />} cursor={{ fill: "var(--muted)/30" }} />
                    <Bar dataKey="leads" name="Total Leads" fill="var(--chart-1)" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="activeLeads" name="Em Atendimento" fill="var(--chart-3)" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ActivityFeed + Gargalos Operacionais */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <ActivityFeed activities={activities} />
        </div>

        {/* Bottleneck Cards */}
        <Card className="rounded-xl border-border/70 bg-card shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle>Gargalos Operacionais</CardTitle>
            <CardDescription>Pontos de atenção</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-2">              <Warning
                className="size-4 text-warning"
                weight="fill"
              />
                <span className="text-sm font-medium">
                  Leads não trabalhados
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {data.totals.unworked}
              </p>
              <p className="text-xs text-muted-foreground">
                Distribuídos há mais de 15 minutos sem contato
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Warning
                  className="size-4 text-destructive"
                  weight="fill"
                />
                <span className="text-sm font-medium">
                  Leads estagnados
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {data.totals.stalled}
              </p>
              <p className="text-xs text-muted-foreground">
                Sem avanço há mais de 3 dias
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <UserList
                  className="size-4 text-chart-2"
                  weight="fill"
                />
                <span className="text-sm font-medium">Equipe</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {data.totals.activeBrokers}/{data.totals.members}
              </p>
              <p className="text-xs text-muted-foreground">
                Corretores ativos vs. cadastrados
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Leads totais', value: totalLeads, color: 'text-chart-1' },
          { label: 'Conversões', value: totalConverted, color: 'text-chart-5' },
          { label: 'Taxa de conversão', value: `${conversionRate}%`, color: 'text-chart-2' },
          { label: 'Corretores ativos', value: `${data.totals.activeBrokers}/${data.totals.members}`, color: 'text-chart-4' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.05, 0.2) }}
            className="rounded-lg border border-border/40 bg-card p-3 text-center shadow-none"
          >
            <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Desempenho por Filial */}
      <Card className="rounded-xl border-border/70 bg-card shadow-none flex flex-col">
        <CardHeader>
          <CardTitle>Desempenho por Filial</CardTitle>
          <CardDescription>
            Leads, ativos e conversão por unidade
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-0">
          <div className="max-h-[500px] overflow-y-auto px-6 pb-6">
            <div className="space-y-4">
              {data.branches.map((branch, i) => (
                <motion.div
                  key={branch.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.06, 0.3) }}
                  className="rounded-lg border border-border/40 bg-muted/20 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {branch.name}
                    </span>
                    <Badge variant="outline" className="rounded-md text-xs">
                      {branch.conversion}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{branch.leads} leads</span>
                    <span>·</span>
                    <span>{branch.activeLeads} ativos</span>
                    <span>·</span>
                    <span>{branch.conversion} conversão</span>
                  </div>
                  <div className="mt-2 relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-5 transition-all duration-700"
                      style={{
                        width: `${branch.leads > 0
                          ? (branch.activeLeads / branch.leads) * 100
                          : 0
                          }%`,
                      }}
                    />
                  </div>
                </motion.div>
              ))}
              {data.branches.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhuma filial cadastrada.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Manager Dashboard ──────────────────────────────────────────────────────

function ManagerNocContent({ data }: { data: ManagerDashboardData }) {
  const teamPercent =
    data.teamSize > 0
      ? Math.round((data.activeMembers / data.teamSize) * 100)
      : 0;
  const newPercent =
    data.leadsTotal > 0
      ? Math.round((data.newLeads / data.leadsTotal) * 100)
      : 0;
  const contactPercent =
    data.leadsTotal > 0
      ? Math.round((data.inContact / data.leadsTotal) * 100)
      : 0;

  const activities = [
    {
      id: 1,
      type: "new_lead",
      message: `${data.newLeads} leads novos aguardando contato`,
      time: "hoje",
      user: "Sistema",
    },
    {
      id: 2,
      type: "alert",
      message: `${data.unworked} leads não trabalhados (+15min sem contato)`,
      time: "agora",
      user: "Alerta",
    },
    {
      id: 3,
      type: "alert",
      message: `${data.stalled} leads estagnados sem avanço há +3 dias`,
      time: "agora",
      user: "Alerta",
    },
    {
      id: 4,
      type: "conversion",
      message: `${data.teamSize - data.activeMembers} corretores offline na filial`,
      time: "hoje",
      user: "Sistema",
    },
  ];

  return (
    <div className="space-y-6">

      {/* ─── ZONA 2: PLANTÃO AO VIVO ─── */}
      <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">PLANTÃO AO VIVO DA FILIAL</p>
              <p className="text-sm font-semibold text-foreground">
                {data.activeMembers} de {data.teamSize} corretores online no plantão de atendimento
              </p>
            </div>
          </div>
          <Button render={<Link href="/leads/distribuicao/plantao" />} size="sm" variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 h-8 text-xs font-semibold gap-1.5">
            <WifiHigh className="size-4" /> Escala do Plantão
          </Button>
        </div>
      </Card>

      {/* ─── ZONA 3: INDICADORES NEUTROS ─── */}
      <section className="space-y-4 pt-2">
        <div className="border-b border-border/50 pb-2">
          <h2 className="text-sm font-bold tracking-tight">Indicadores de Desempenho</h2>
          <p className="text-xs text-muted-foreground">Métricas operacionais da unidade.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Corretores Ativos" value={data.activeMembers} change={`${teamPercent}%`} sublabel={`${data.teamSize} cadastrados`} animated sparklineData={data.trend.map((t, idx) => Math.round((t.leads + 1) * (0.2 + (idx % 4) * 0.05)))} sparklineColor="var(--chart-1)" />
          <StatCard label="Leads Novos" value={data.newLeads} change={`${newPercent}% do total`} sublabel={`${data.unassigned} sem resp.`} animated animationDelay={0.08} sparklineData={data.trend.map((t) => t.leads)} sparklineColor="var(--chart-3)" />
          <StatCard label="Em Atendimento" value={data.inContact} change={`${contactPercent}%`} sublabel={`de ${data.leadsTotal} totais`} animated animationDelay={0.16} sparklineData={data.trend.map((t) => Math.max(0, t.leads - t.converted))} sparklineColor="var(--chart-4)" />
          <StatCard label="Não Trabalhados" value={data.unworked} change={data.unworked > 0 ? "urgente" : "ok"} sublabel="Há +15min sem contato" animated animationDelay={0.24} sparklineData={data.trend.map((t) => Math.round(t.leads * 0.2))} sparklineColor="var(--chart-2)" />
          <StatCard label="Estagnados" value={data.stalled} change={data.stalled > 0 ? "atenção" : "ok"} sublabel="Há +3 dias sem avanço" animated animationDelay={0.32} sparklineData={data.trend.map((t) => Math.round(t.leads * 0.1))} sparklineColor="var(--chart-5)" />
        </div>
      </section>

      {/* Team Overview + Bottlenecks */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        <Card className="rounded-xl border-border/70 bg-card shadow-none lg:col-span-4">
          <CardHeader>
            <CardTitle>Visão Geral da Equipe</CardTitle>
            <CardDescription>
              Capacidade operacional da filial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">
                  Corretores Ativos
                </span>
                <span className="text-muted-foreground">
                  {data.activeMembers}/{data.teamSize}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-5 transition-all duration-700"
                  style={{ width: `${teamPercent}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">Leads Novos</span>
                <span className="text-muted-foreground">
                  {data.newLeads}/{data.leadsTotal}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-3 transition-all duration-700"
                  style={{ width: `${newPercent}%` }}
                />
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">
                  Em Atendimento
                </span>
                <span className="text-muted-foreground">
                  {data.inContact}/{data.leadsTotal}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-chart-4 transition-all duration-700"
                  style={{ width: `${contactPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/70 bg-card shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle>Alertas</CardTitle>
            <CardDescription>Pontos que precisam de ação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-2">              <Warning
                className="size-4 text-warning"
                weight="fill"
              />
                <span className="text-sm font-medium">
                  Não trabalhados
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {data.unworked}
              </p>
              <p className="text-xs text-muted-foreground">
                Leads distribuídos sem contato inicial
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Warning
                  className="size-4 text-destructive"
                  weight="fill"
                />
                <span className="text-sm font-medium">
                  Estagnados
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {data.stalled}
              </p>
              <p className="text-xs text-muted-foreground">
                Sem avanço há mais de 3 dias
              </p>
            </div>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-chart-2" weight="fill" />
                <span className="text-sm font-medium">
                  Sem responsável
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {data.unassigned}
              </p>
              <p className="text-xs text-muted-foreground">
                Leads não atribuídos a nenhum corretor
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Manager Charts Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Branch Lead Influx Trend */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
          className="lg:col-span-4"
        >
          <Card className="rounded-xl border-border/70 bg-card shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Influxo Diário de Leads</CardTitle>
                  <CardDescription>Demanda da unidade nos últimos 30 dias</CardDescription>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {data.leadsTotal} leads totais
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => val ? `${val.split('-')[2]}/${val.split('-')[1]}` : ''}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltipWrapper />} cursor={{ fill: "var(--muted)/30" }} />
                    <Bar dataKey="leads" name="Novos Leads" fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Operational Distribution Donut */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.08 }}
          className="lg:col-span-3"
        >
          <Card className="rounded-xl border-border/70 bg-card shadow-none h-full">
            <CardHeader>
              <CardTitle>Distribuição Operacional</CardTitle>
              <CardDescription>Status dos leads na unidade</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center">
              <div className="h-48 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Novos", value: data.newLeads, color: "var(--chart-3)" },
                        { name: "Em Atendimento", value: data.inContact, color: "var(--chart-4)" },
                        { name: "Sem Atribuição", value: data.unassigned, color: "var(--chart-1)" },
                        { name: "Não Trabalhados", value: data.unworked, color: "var(--chart-2)" },
                        { name: "Estagnados", value: data.stalled, color: "var(--chart-5)" },
                      ].filter((d) => d.value > 0)}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {[
                        { name: "Novos", value: data.newLeads, color: "var(--chart-3)" },
                        { name: "Em Atendimento", value: data.inContact, color: "var(--chart-4)" },
                        { name: "Sem Atribuição", value: data.unassigned, color: "var(--chart-1)" },
                        { name: "Não Trabalhados", value: data.unworked, color: "var(--chart-2)" },
                        { name: "Estagnados", value: data.stalled, color: "var(--chart-5)" },
                      ].filter((d) => d.value > 0).map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipWrapper />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Activity Feed + Stats */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <ActivityFeed activities={activities} />
        <div className="grid grid-cols-2 gap-3 content-start">
          {[
            { label: 'Leads totais', value: data.leadsTotal, color: 'text-chart-1' },
            { label: 'Leads novos', value: data.newLeads, color: 'text-chart-3' },
            { label: 'Corretores ativos', value: data.activeMembers, color: 'text-chart-5' },
            { label: 'Em atendimento', value: data.inContact, color: 'text-chart-4' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.05, 0.2) }}
              className="rounded-lg border border-border/40 bg-card p-3 text-center shadow-none"
            >
              <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Broker Dashboard ────────────────────────────────────────────────────────

function BrokerNocContent({ data }: { data: BrokerDashboardData }) {
  const activePercent =
    data.totals.all > 0
      ? Math.round((data.totals.active / data.totals.all) * 100)
      : 0;
const activities = [
    {
      id: 1,
      type: "alert",
      message: `${data.pendingStaleness.overdueCount} leads com SLA de atendimento pendente`,
      time: "agora",
      user: "Alerta",
    },
    {
      id: 2,
      type: "new_lead",
      message: `${data.totals.distributed} leads novos na sua fila`,
      time: "hoje",
      user: "Sistema",
    },
    {
      id: 3,
      type: "conversion",
      message: `${data.totals.converted} conversões finalizadas`,
      time: "hoje",
      user: "Sistema",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ─── ZONA 2: PLANTÃO AO VIVO ─── */}
      <Card className="rounded-2xl border border-border bg-card p-5 shadow-none transition-all duration-200 hover:border-border-strong">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <Badge variant="outline" className="gap-2 rounded-full border-emerald-500/20 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              PLANTÃO DO CORRETOR
            </Badge>
            <p className="text-xs sm:text-sm font-medium text-foreground">
              Status: <span className="font-bold">{data.availabilityStatus === "available" ? "Disponível para Receber Leads" : data.availabilityStatus === "paused" ? "Pausado" : "Offline"}</span> • {data.branchName}
            </p>
          </div>
          <Button render={<Link href="/minha-fila" />} size="sm" variant="default" className="h-9 px-4 text-xs font-semibold gap-2 shrink-0">
            <WifiHigh className="size-4" /> Ir para Minha Fila
          </Button>
        </div>
      </Card>

      {/* ─── ZONA 3: INDICADORES NEUTROS ─── */}
      <section className="space-y-4 pt-2">
        <div className="border-b border-border/50 pb-2">
          <h2 className="text-sm font-bold tracking-tight">Indicadores de Desempenho Pessoal</h2>
          <p className="text-xs text-muted-foreground">Métricas da sua carteira comercial.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Leads Totais" value={data.totals.all} change="Carteira" sublabel="Atribuídos a você" animated sparklineData={data.trend.map((t) => t.leads)} sparklineColor="var(--chart-1)" />
          <StatCard label="Em Atendimento" value={data.totals.active} change={`${activePercent}%`} sublabel="Leads ativos" animated animationDelay={0.08} sparklineData={data.trend.map((t) => Math.max(0, t.leads - t.converted))} sparklineColor="var(--chart-3)" />
          <StatCard label="Conversões" value={data.totals.converted} change="Finalizados" sublabel="Vendas concluídas" animated animationDelay={0.16} sparklineData={data.trend.map((t) => t.converted)} sparklineColor="var(--chart-5)" />
          <StatCard label="SLA Pendente" value={data.pendingStaleness.overdueCount} change={data.pendingStaleness.overdueCount > 0 ? "Atenção" : "Ok"} sublabel="Aguardando primeiro contato" animated animationDelay={0.24} sparklineData={data.trend.map((t) => Math.round(t.leads * 0.15))} sparklineColor="var(--chart-4)" />
        </div>
      </section>

      {/* Leads */}
      <Card className="rounded-xl border-border/70 bg-card shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Minha Carteira de Leads</CardTitle>
              <CardDescription>Leads sob sua responsabilidade</CardDescription>
            </div>
            <Button render={<Link href="/leads" />} size="sm" variant="outline" className="text-xs h-8">
              Ver Todos
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {data.leads.slice(0, 5).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/20 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.phone} • {lead.source || "Manual"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <LeadStatusBadge status={lead.status} />
                  <Button render={<Link href={`/conversas?leadId=${lead.id}`} />} size="sm" variant="ghost" className="h-7 text-xs">
                    Atender
                  </Button>
                </div>
              </div>
            ))}
            {data.leads.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Nenhum lead atribuído no momento.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Broker Personal Performance Chart */}
      <Card className="rounded-xl border-border/70 bg-card shadow-none">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Minha Evolução Comercial</CardTitle>
              <CardDescription>Evolução diária de atendimentos e conversões (30 dias)</CardDescription>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-chart-1" />
                Leads Atribuídos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-chart-5" />
                Vendas Concluídas
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="brokerLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="brokerConvertedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => val ? `${val.split('-')[2]}/${val.split('-')[1]}` : ''}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltipWrapper />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                <Area type="monotone" dataKey="leads" name="Leads Recebidos" fill="url(#brokerLeadsGrad)" stroke="var(--chart-1)" strokeWidth={2} />
                <Area type="monotone" dataKey="converted" name="Vendas Concluídas" fill="url(#brokerConvertedGrad)" stroke="var(--chart-5)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Activity Feed + Stats */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <ActivityFeed activities={activities} />
        <div className="grid grid-cols-2 gap-3 content-start">
          {[
            { label: 'Leads totais', value: data.totals.all, color: 'text-chart-1' },
            { label: 'Em atendimento', value: data.totals.active, color: 'text-chart-3' },
            { label: 'Conversões', value: data.totals.converted, color: 'text-chart-5' },
            { label: 'Perdidos', value: data.totals.lost, color: 'text-chart-4' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.05, 0.2) }}
              className="rounded-lg border border-border/40 bg-card p-3 text-center shadow-none"
            >
              <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NocDashboardContent(props: RoleProps) {
  const title =
    props.role === "director"
      ? "Visão Geral da Operação"
      : props.role === "manager"
      ? "Dashboard da Filial"
      : "Painel do Corretor";

  const breadcrumb =
    props.role === "director"
      ? "Dashboard / Diretor"
      : props.role === "manager"
      ? "Dashboard / Gestão"
      : "Dashboard / Corretor";

  return (
    <>
      <DashboardHeader
        breadcrumb={breadcrumb}
        title={title}
        rightSlot={<NocHeaderSlot />}
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        {props.role === "director" && <DirectorNocContent data={props.data} />}
        {props.role === "manager" && <ManagerNocContent data={props.data} />}
        {props.role === "broker" && <BrokerNocContent data={props.data} />}
      </main>
    </>
  );
}
