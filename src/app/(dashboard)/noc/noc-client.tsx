"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ChartBar,
  CheckCircle,
  Circle,
  Database,
  FileText,
  Lightning,
  Phone,
  Plug,
  SealCheck,
  Users,
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
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChartLineUp, SlidersHorizontal } from "@/components/huge-icons";
import { StatCard } from "@/components/dashboard/metric-card";
import { INITIAL_DIMENSION } from "@/components/ui/chart";
import { formatCurrency } from "@/features/quotes/utils";
import type { NocData } from "@/features/noc/queries";
import { NocHeatmap } from "@/features/noc/components/noc-heatmap";
import { NocAnomalyAlerts } from "@/features/noc/components/noc-anomaly-alerts";

// ─── Static "services" (infra mock) ──────────────────────────────────────────

const services = [
  { name: "API Principal", status: "operational" as const, uptime: "99.97%", latency: "45ms", icon: Plug },
  { name: "Banco de Dados", status: "operational" as const, uptime: "99.99%", latency: "12ms", icon: Database },
  { name: "Webhook", status: "operational" as const, uptime: "99.88%", latency: "120ms", icon: WifiHigh },
  { name: "WhatsApp", status: "operational" as const, uptime: "99.95%", latency: "230ms", icon: Phone },
  { name: "E-mail", status: "operational" as const, uptime: "99.7%", latency: "480ms", icon: FileText },
  { name: "CDN", status: "operational" as const, uptime: "100%", latency: "28ms", icon: Lightning },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(s: number | null): string {
  if (s === null || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const secs = Math.round(s % 60);
  if (m === 0) return `${secs}s`;
  return `${m}m${String(secs).padStart(2, "0")}s`;
}

function formatDelta(delta: number, unit: string = "%"): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta}${unit}`;
}

function relativetime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: "operational" | "degraded" | "down" }) {
  if (status === "operational") return <SealCheck className="size-4 text-success" weight="fill" />;
  if (status === "degraded")    return <Warning className="size-4 text-warning" weight="fill" />;
  return <XCircle className="size-4 text-destructive" weight="fill" />;
}

function ActivityIcon({ type }: { type: string }) {
  switch (type) {
    case "conversion": return <CheckCircle className="size-3.5 text-success" weight="fill" />;
    case "new_lead": return <Users className="size-3.5 text-chart-3" weight="fill" />;
    case "quote": return <FileText className="size-3.5 text-chart-2" weight="fill" />;
    case "alert": return <Warning className="size-3.5 text-warning" weight="fill" />;
    default: return <Circle className="size-3.5 text-muted-foreground" weight="fill" />;
  }
}

// NocMetricCard substituído por StatCard + motion wrapper

function ChartTooltipWrapper({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

const HEALTH_LABELS = {
  healthy: "Estável",
  attention: "Atenção",
  critical: "Crítico",
} as const;

const HEALTH_VARIANTS = {
  healthy: "success",
  attention: "warning",
  critical: "destructive",
} as const;

function BranchHealthTable({ branches }: { branches: NocData["branchHealth"] }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredBranches = normalizedSearch
    ? branches.filter((branch) => branch.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch))
    : branches;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border/60 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <CardTitle>Saúde das unidades</CardTitle>
          <CardDescription className="mt-1">Priorize risco de SLA, fila sem corretor e capacidade disponível por filial.</CardDescription>
        </div>
        {branches.length > 1 ? (
          <Input
            aria-label="Buscar unidade no NOC"
            className="h-9 w-full bg-muted/40 md:w-64"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar unidade"
            value={search}
          />
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {filteredBranches.length ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5">Unidade</TableHead>
                <TableHead>Saúde operacional</TableHead>
                <TableHead className="text-right">Leads hoje</TableHead>
                <TableHead className="text-right">Em atendimento</TableHead>
                <TableHead className="text-right">Fila sem corretor</TableHead>
                <TableHead className="text-right">Risco SLA</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead className="pr-5 text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBranches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="pl-5">
                    <p className="font-medium text-foreground">{branch.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{branch.acceptingLeads ? "Recebendo leads" : "Recebimento pausado"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className="gap-1.5" variant={HEALTH_VARIANTS[branch.health]}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {HEALTH_LABELS[branch.health]}
                    </Badge>
                    <p className="mt-1 max-w-52 whitespace-normal text-xs leading-4 text-muted-foreground">{branch.healthReason}</p>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{branch.leadsToday}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{branch.activeAttendances}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", branch.unassignedLeads > 0 && "text-warning")}>{branch.unassignedLeads}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", branch.slaRiskLeads > 0 && "text-destructive")}>{branch.slaRiskLeads}</TableCell>
                  <TableCell>
                    <span className={cn("font-medium tabular-nums", branch.availableBrokers === 0 && "text-warning")}>{branch.availableBrokers}/{branch.totalBrokers}</span>
                    <span className="ml-1 text-xs text-muted-foreground">disponíveis</span>
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Link className="inline-flex h-8 items-center rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8" href={`/leads?branch=${branch.id}`}>
                      Ver leads <ArrowUpRight className="ml-1 size-3.5" weight="bold" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma unidade corresponde à busca.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export type NocClientProps = {
  data: NocData;
};

export function NocClient({ data }: NocClientProps) {
  const router = useRouter();



  const { kpis, leadFlow, statusDistribution, hourlyActivity, teamPerformance, recentActivity, branchHealth, firstContactTrend, ticketTrend } = data;

  // Derived KPI cards
  const contactDelta = kpis.avgFirstContactSecondsYesterday && kpis.avgFirstContactSeconds
    ? Math.round(kpis.avgFirstContactSeconds - kpis.avgFirstContactSecondsYesterday)
    : null;

  const ticketDelta = kpis.avgTicketLastMonth > 0
    ? Math.round(((kpis.avgTicketMonth - kpis.avgTicketLastMonth) / kpis.avgTicketLastMonth) * 100)
    : 0;

  const metrics = [
    {
      label: "Leads Hoje",
      value: kpis.leadsToday,
      change: formatDelta(kpis.leadsTodayVsYesterday),
      trend: kpis.leadsTodayVsYesterday >= 0 ? "up" as const : "down" as const,
      description: `vs. ontem (${Math.max(0, kpis.leadsToday - (kpis.leadsTodayVsYesterday >= 0 ? Math.round(kpis.leadsToday / (1 + kpis.leadsTodayVsYesterday / 100)) : kpis.leadsToday))} leads)`,
      sparklineData: leadFlow.map((day) => day.leads),
      sparklineColor: "var(--chart-1)",
    },
    {
      label: "Atendimentos Ativos",
      value: kpis.activeAttendances,
      change: "ao vivo",
      trend: "neutral" as const,
      description: "Leads em atendimento agora",
      sparklineData: leadFlow.map((day) => day.contatos),
      sparklineColor: "var(--chart-3)",
    },
    {
      label: "Taxa de Conversão",
      value: `${kpis.conversionRateMonth}%`,
      change: formatDelta(kpis.conversionRateMonth - kpis.conversionRateLastMonth, "pp"),
      trend: kpis.conversionRateMonth >= kpis.conversionRateLastMonth ? "up" as const : "down" as const,
      description: `Período anterior: ${kpis.conversionRateLastMonth}%`,
      sparklineData: leadFlow.map((day) => day.conversoes),
      sparklineColor: "var(--chart-5)",
    },
    {
      label: "Tempo Médio 1º Contato",
      value: formatSeconds(kpis.avgFirstContactSeconds),
      change: contactDelta !== null ? formatDelta(-contactDelta, "s") : "—",
      trend: contactDelta !== null && contactDelta < 0 ? "up" as const : contactDelta !== null && contactDelta > 0 ? "down" as const : "neutral" as const,
      description: "Desde a criação até o primeiro contato",
      sparklineData: firstContactTrend,
      sparklineColor: "var(--chart-4)",
    },
    {
      label: "Ticket Médio",
      value: formatCurrency(kpis.avgTicketMonth, { maximumFractionDigits: 0 }),
      change: formatDelta(ticketDelta),
      trend: ticketDelta >= 0 ? "up" as const : "down" as const,
      description: `Período anterior: ${formatCurrency(kpis.avgTicketLastMonth, { maximumFractionDigits: 0 })}`,
      sparklineData: ticketTrend,
      sparklineColor: "var(--chart-2)",
    },
  ];

  const totalLeadsWeek = leadFlow.reduce((a, d) => a + d.leads, 0);
  const totalConversionsWeek = leadFlow.reduce((a, d) => a + d.conversoes, 0);

  return (
    <>
      {/* Status Header */}
      <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-none lg:flex-row lg:items-center lg:justify-between">

        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-success/10">
            <SealCheck className="size-5 text-success" weight="fill" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Todos os sistemas operacionais</h2>
            <p className="text-xs text-muted-foreground">
              {services.filter((s) => s.status === "operational").length} de {services.length} serviços online
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {services.slice(0, 4).map((s) => (
            <Badge key={s.name} variant="outline" className="gap-1.5 rounded-md text-xs font-normal">
              <StatusIndicator status={s.status} />
              {s.name}
            </Badge>
          ))}
          <Badge variant="outline" className="gap-1 rounded-md text-xs font-normal">
            +{services.length - 4}
          </Badge>
        </div>
      </section>

      {/* Metric Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {metrics.map((metric, i) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            change={metric.change}
            sublabel={metric.description}
            sparklineData={metric.sparklineData}
            sparklineColor={metric.sparklineColor}
            animated
            animationDelay={i * 0.08}
          />
        ))}
      </section>

      {/* Operational Anomaly Alerts */}
      <NocAnomalyAlerts branches={branchHealth} />

      {/* Enterprise Heatmap Command Center */}
      <NocHeatmap branches={branchHealth} />

      <BranchHealthTable branches={branchHealth} />

      {/* Charts Row */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Lead Flow Area Chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}>
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Fluxo de Leads</CardTitle>
                  <CardDescription>Últimos 7 dias — leads, contatos e conversões</CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-[var(--chart-1)]" />
                    Leads
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-[var(--chart-3)]" />
                    Contatos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-[var(--chart-5)]" />
                    Conversões
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer height="100%" width="100%" initialDimension={INITIAL_DIMENSION}>
                  <AreaChart data={leadFlow} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="leadsGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="contatosGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="conversoesGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis axisLine={false} dataKey="dia" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickLine={false} />
                    <YAxis axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickLine={false} />
                    <Tooltip content={<ChartTooltipWrapper />} cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }} />
                    <Area dataKey="leads" fill="url(#leadsGradient)" name="Leads" stroke="var(--chart-1)" strokeWidth={2} type="monotone" animationDuration={500} animationEasing="ease-out" />
                    <Area dataKey="contatos" fill="url(#contatosGradient)" name="Contatos" stroke="var(--chart-3)" strokeWidth={2} type="monotone" animationDuration={500} animationEasing="ease-out" animationBegin={100} />
                    <Area dataKey="conversoes" fill="url(#conversoesGradient)" name="Conversões" stroke="var(--chart-5)" strokeWidth={2} type="monotone" animationDuration={500} animationEasing="ease-out" animationBegin={200} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Status Distribution Pie */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.08 }}>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>Leads por etapa nos últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {statusDistribution.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Sem dados no período</div>
              ) : (
                <>
                  <div className="flex h-64 items-center justify-center">
                    <ResponsiveContainer height="100%" width="100%" initialDimension={INITIAL_DIMENSION}>
                      <PieChart>
                        <Pie
                          cx="50%"
                          cy="50%"
                          data={statusDistribution}
                          dataKey="value"
                          endAngle={-270}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          strokeWidth={0}
                          animationDuration={600}
                          animationEasing="ease-out"
                        >
                          {statusDistribution.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltipWrapper />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-bold tabular-nums">
                        {statusDistribution.reduce((a, b) => a + b.value, 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {statusDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="ml-auto font-medium tabular-nums">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Second Row */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Hourly Activity */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Atividade Hoje</CardTitle>
              <CardDescription>Leads recebidos e contatos por hora</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer height="100%" width="100%" initialDimension={INITIAL_DIMENSION}>
                  <BarChart data={hourlyActivity} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis axisLine={false} dataKey="hora" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} />
                    <YAxis axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} />
                    <Tooltip content={<ChartTooltipWrapper />} cursor={{ fill: "var(--muted)" }} />
                    <Legend formatter={(value: string) => <span className="text-xs text-muted-foreground">{value}</span>} iconSize={8} />
                    <Bar barSize={12} dataKey="leads" name="Leads" fill="var(--chart-1)" radius={[3, 3, 0, 0]} animationDuration={400} animationEasing="ease-out" />
                    <Bar barSize={12} dataKey="contatos" name="Contatos" fill="var(--chart-3)" radius={[3, 3, 0, 0]} animationDuration={400} animationEasing="ease-out" animationBegin={100} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Performance */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Desempenho da Equipe</CardTitle>
            <CardDescription>Corretores — leads e conversões hoje</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamPerformance.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem dados de corretores hoje</p>
            ) : (
              teamPerformance.map((member, i) => (
                <motion.div
                  key={member.userId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.05, 0.25) }}
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{member.nome}</span>
                    <span className="text-muted-foreground">
                      {member.conversoes}/{member.leads} · {member.taxa}%
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${member.taxa}%`,
                        backgroundColor:
                          member.taxa >= 40
                            ? "var(--chart-5)"
                            : member.taxa >= 20
                              ? "var(--chart-3)"
                              : "var(--muted-foreground)",
                      }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </CardContent>
        </Card>

        {/* System Health (static) */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Status dos Serviços</CardTitle>
            <CardDescription>Saúde atual da infraestrutura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {services.map((service, i) => {
              const Icon = service.icon;
              return (
                <motion.div
                  key={service.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.06, 0.3) }}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className={cn("flex size-8 items-center justify-center rounded-lg", service.status === "operational" ? "bg-success/10" : service.status === "degraded" ? "bg-accent/10" : "bg-destructive/10")}>
                    <Icon className={cn("size-4", service.status === "operational" ? "text-success" : service.status === "degraded" ? "text-warning" : "text-destructive")} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{service.name}</span>
                      <StatusIndicator status={service.status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Uptime: {service.uptime}</span>
                      <span>·</span>
                      <span>{service.latency}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription>Movimentações em tempo real da operação</CardDescription>
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
              {recentActivity.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">Sem atividades recentes</p>
              ) : (
                recentActivity.map((activity, i) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.03, 0.3) }}
                    className="flex items-start gap-4 border-b border-border/40 px-6 py-3.5 transition-colors last:border-0 hover:bg-muted/20"
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
                        <span>{relativetime(new Date(activity.time))}</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Stats Bar */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Leads na semana", value: totalLeadsWeek, color: "text-chart-1", bg: "bg-chart-1/10", icon: ChartBar },
          { label: "Conversões na semana", value: totalConversionsWeek, color: "text-chart-5", bg: "bg-chart-5/10", icon: CheckCircle },
          {
            label: "Taxa de conversão semanal",
            value: totalLeadsWeek > 0 ? `${Math.round((totalConversionsWeek / totalLeadsWeek) * 100)}%` : "0%",
            color: "text-chart-2",
            bg: "bg-chart-2/10",
            icon: ChartLineUp,
          },
          {
            label: "Serviços operacionais",
            value: `${services.filter((s) => s.status === "operational").length}/${services.length}`,
            color: "text-chart-4",
            bg: "bg-chart-4/10",
            icon: SlidersHorizontal,
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: Math.min(i * 0.05, 0.2) }}
              whileHover={{ y: -2 }}
              className="group flex flex-col justify-between rounded-xl border border-border/60 bg-card p-4 text-left shadow-none transition-all duration-200 hover:border-border hover:shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110", stat.bg, stat.color)}>
                  <Icon className="size-4" />
                </span>
                <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">NOC</span>
              </div>
              <div className="mt-3 space-y-1">
                <p className={cn("text-2xl font-bold tabular-nums tracking-tight", stat.color)}>{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </>
  );
}

// ─── Header Slot (clock + live badge) ────────────────────────────────────────

export function NocHeaderSlot() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setCurrentTime(new Date()), 0);
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(timer);
    };
  }, []);

  const formattedTime = currentTime?.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedDate = currentTime?.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs tabular-nums sm:flex text-muted-foreground font-medium shrink-0">
        <WifiHigh className="size-3.5 text-emerald-500 shrink-0" weight="fill" />
        <span className="shrink-0">{formattedDate ? `${formattedDate},` : ""}</span>
        <span className="font-semibold text-foreground shrink-0">{formattedTime ?? "--:--"}</span>
      </div>
      <Badge showIcon={false} className="shrink-0 gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-none">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="shrink-0">Ao vivo</span>
      </Badge>
    </div>
  );
}
