"use client";

import { motion } from "motion/react";
import {
  ArrowUpRight,
  CalendarCheck,
  ChartLineUp,
  CurrencyCircleDollar,
  PiggyBank,
  Target,
  TrendDown,
  TrendUp,
  WarningCircle,
} from "@/components/huge-icons";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { formatCurrency, formatCurrencyCompact } from "@/features/quotes/utils";
import type { FinancialDashboardData } from "@/features/financeiro/queries";

type Props = {
  data: FinancialDashboardData;
  role: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────


function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m, 10) - 1]}/${y.slice(2)}`;
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
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{" "}
          <span className="font-medium text-foreground">
            {formatCurrency(String(entry.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  trend,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; weight?: string }>;
  trend?: { value: string; isUp: boolean };
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0, 0, 0.2, 1], delay }}
      whileHover={{ y: -2, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
      whileTap={{ scale: 0.995 }}
    >
      <Card className="group/card border-border bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm">
        <CardHeader className="pb-1">
          <div className="flex items-center justify-between">
            <CardDescription className="transition-colors duration-200 group-hover/card:text-foreground">
              {label}
            </CardDescription>
            <Icon className="size-4 text-muted-foreground transition-colors duration-200 group-hover/card:text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          {trend && (
            <div className="mt-1 flex items-center gap-1">
              {trend.isUp ? (
                <TrendUp className="size-3 text-emerald-500" weight="fill" />
              ) : (
                <TrendDown className="size-3 text-rose-500" weight="fill" />
              )}
              <span
                className={`text-xs ${trend.isUp
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
                  }`}
              >
                {trend.value}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function FinancialDashboard({ data, role }: Props) {
  const { summary, recentSales, pendingSchedules, activeGoals, monthlyTrend } =
    data;

  const chartData = monthlyTrend.map((m) => ({
    month: formatMonth(m.month),
    Receita: parseFloat(m.revenue),
    Comissões: parseFloat(m.commissions),
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Receita total"
          value={formatCurrencyCompact(summary.totalRevenue)}
          icon={ChartLineUp}
          delay={0}
        />
        <SummaryCard
          label="Comissões pendentes"
          value={formatCurrencyCompact(summary.pendingCommissions)}
          icon={WarningCircle}
          delay={0.06}
          trend={{
            value: `${summary.pendingCommissions} a pagar`,
            isUp: parseFloat(summary.pendingCommissions) > 0,
          }}
        />
        <SummaryCard
          label="Comissões pagas"
          value={formatCurrencyCompact(summary.paidCommissions)}
          icon={CurrencyCircleDollar}
          delay={0.12}
        />
        <SummaryCard
          label={role === "broker" ? "Minhas vendas" : "Vendas realizadas"}
          value={String(summary.salesCount)}
          icon={PiggyBank}
          delay={0.18}
          trend={{
            value: `${summary.activeGoals} ${summary.activeGoals === 1 ? "meta ativa" : "metas ativas"}`,
            isUp: summary.activeGoals > 0,
          }}
        />
      </section>

      {/* Period Summary + Chart */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Revenue Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.08 }}
          className="lg:col-span-4"
        >
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Receita vs Comissões</CardTitle>
                  <CardDescription>
                    Últimos 6 meses — Receita bruta e comissões acumuladas
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-chart-1" />
                    Receita
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full bg-chart-4" />
                    Comissões
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer height="100%" width="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="commGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      axisLine={false}
                      dataKey="month"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `R$${(v / 1000).toFixed(0)}K` : `R$${v}`
                      }
                    />
                    <Tooltip
                      content={<ChartTooltipWrapper />}
                      cursor={{
                        stroke: "var(--border)",
                        strokeDasharray: "3 3",
                      }}
                    />
                    <Area
                      dataKey="Receita"
                      fill="url(#revGradient)"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      type="monotone"
                      animationDuration={600}
                      animationEasing="ease-out"
                    />
                    <Area
                      dataKey="Comissões"
                      fill="url(#commGradient)"
                      stroke="var(--chart-4)"
                      strokeWidth={2}
                      type="monotone"
                      animationDuration={600}
                      animationEasing="ease-out"
                      animationBegin={150}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Period Stats */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.16 }}
          className="lg:col-span-3"
        >
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Resumo do período</CardTitle>
              <CardDescription>Mês atual ({monthlyTrend[monthlyTrend.length - 1]?.month ?? "—"})</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Receita do período</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(summary.periodRevenue)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total de vendas</span>
                  <span className="font-semibold tabular-nums">
                    {summary.salesCount}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total comissões</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(summary.totalCommissions)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Comissões Pendentes vs Pagas
                </p>
                <div className="relative h-3 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-chart-4"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${parseFloat(summary.totalCommissions) > 0
                        ? (parseFloat(summary.pendingCommissions) /
                          parseFloat(summary.totalCommissions)) *
                        100
                        : 0
                        }%`,
                    }}
                    transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-chart-4" />
                    {formatCurrency(summary.pendingCommissions)} pendente
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-emerald-500" />
                    {formatCurrency(summary.paidCommissions)} pago
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/vendas" />}
                >
                  <ArrowUpRight className="size-3.5" />
                  Ver vendas
                </Button>
                {(role === "director" || role === "manager") && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/configuracoes/comissoes" />}
                  >
                    <CurrencyCircleDollar className="size-3.5" />
                    Comissões
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Active Goals + Pending Schedules */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-7">
        {/* Active Goals */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.24 }}
          className="lg:col-span-4"
        >
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Metas ativas</CardTitle>
                  <CardDescription>
                    {activeGoals.length > 0
                      ? `${activeGoals.length} ${activeGoals.length === 1 ? "meta em andamento" : "metas em andamento"}`
                      : "Nenhuma meta ativa no período atual"}
                  </CardDescription>
                </div>
                {role !== "broker" && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href="/metas" />}
                  >
                    <Target className="size-3.5" />
                    Gerenciar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeGoals.length > 0 ? (
                activeGoals.map((goal, i) => {
                  const pct = goal.percentage
                    ? Math.min(100, Math.max(0, parseFloat(goal.percentage)))
                    : 0;
                  const barColor =
                    pct >= 100
                      ? "bg-emerald-500"
                      : pct >= 60
                        ? "bg-primary"
                        : pct >= 30
                          ? "bg-amber-500"
                          : "bg-rose-500";

                  return (
                    <motion.div
                      key={goal.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.15,
                        ease: [0, 0, 0.2, 1],
                        delay: Math.min(i * 0.06, 0.3),
                      }}
                      className="rounded-lg border border-border/40 bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {goal.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {goal.period} · {goal.targetValue}
                            {goal.targetType === "revenue" ? " (R$)" : ""}
                          </p>
                        </div>
                        <span
                          className={`ml-3 text-sm font-semibold tabular-nums ${pct >= 100
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                            }`}
                        >
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-2 relative h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{
                            duration: 0.8,
                            ease: [0, 0, 0.2, 1],
                            delay: Math.min(i * 0.1, 0.4),
                          }}
                        />
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <Target className="size-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {role === "broker"
                      ? "Nenhuma meta atribuída para este período."
                      : "Nenhuma meta ativa. Crie metas para acompanhar o desempenho."}
                  </p>
                  {role !== "broker" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      render={<Link href="/metas" />}
                    >
                      <Target className="size-3.5" />
                      Criar meta
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pending Schedules */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.32 }}
          className="lg:col-span-3"
        >
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Próximos Repasses</CardTitle>
              <CardDescription>
                {pendingSchedules.length > 0
                  ? `${pendingSchedules.length} ${pendingSchedules.length === 1 ? "parcela pendente" : "parcelas pendentes"}`
                  : "Nenhum repasse pendente"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingSchedules.length > 0 ? (
                pendingSchedules.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.15,
                      ease: [0, 0, 0.2, 1],
                      delay: Math.min(i * 0.06, 0.3),
                    }}
                    className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-3"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-chart-4/10">
                      <CalendarCheck className="size-4 text-chart-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {item.leadName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.referenceMonth} · {item.monthNumber}ª parcela
                        {item.dueDate && (
                          <>
                            {" · "}
                            Vence{" "}
                            {new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                            }).format(new Date(item.dueDate))}
                          </>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {formatCurrency(item.amount)}
                    </span>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <CalendarCheck className="size-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Todas as comissões estão em dia.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* Recent Sales */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0, 0, 0.2, 1], delay: 0.4 }}
      >
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vendas recentes</CardTitle>
                <CardDescription>
                  Últimas{" "}
                  {recentSales.length > 0
                    ? `${Math.min(recentSales.length, 10)} vendas realizadas`
                    : "vendas realizadas"}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" render={<Link href="/vendas" />}>
                <ArrowUpRight className="size-3.5" />
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Lead
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Corretor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Data
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentSales.map((sale, i) => (
                      <motion.tr
                        key={sale.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.12,
                          delay: Math.min(i * 0.03, 0.3),
                        }}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/vendas/${sale.id}`}
                            className="font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {sale.leadName}
                          </Link>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {sale.brokerName ?? "—"}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground tabular-nums">
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                          }).format(new Date(sale.saleDate))}
                        </td>
                        <td className="px-6 py-3 text-right font-medium tabular-nums">
                          {formatCurrency(sale.saleValue)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Badge
                            variant={
                              sale.status === "active" ? "success" : "outline"
                            }
                            className="rounded-md text-xs"
                          >
                            {sale.status === "active"
                              ? "Ativa"
                              : "Cancelada"}
                          </Badge>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-center">
                <PiggyBank className="size-10 text-muted-foreground/40" />
                <p className="mt-3 text-sm font-medium">
                  Nenhuma venda registrada
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  As vendas aparecerão aqui automaticamente quando leads forem
                  convertidos.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
