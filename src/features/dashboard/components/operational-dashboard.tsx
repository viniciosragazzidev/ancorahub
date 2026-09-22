"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, ChartBar, ShieldStar, TrendUp, Warning } from "@/components/huge-icons";
import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";
import { cn } from "@/lib/utils";
import type { DashboardViewData } from "../service";
import {
  AttentionPanel,
  DashboardMetricCard,
  PerformancePanel,
  QualificationPanel,
  RecentPanel,
  TrendPanel,
} from "./dashboard-widgets";

const staggerParent = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.02 } },
};

const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0, 0, 0.2, 1] as const } },
};

const statusLabel: Record<string, string> = {
  new: "Novo",
  distributed: "Distribuído",
  in_contact: "Em atendimento",
  quote_sent: "Proposta",
  negotiation: "Negociação",
  converted: "Convertido",
  lost: "Perdido",
};

const metricIcons: Record<string, React.ReactNode> = {
  "leads-received": <ChartBar />,
  conversion: <TrendUp />,
  attention: <Warning />,
  sales: <ShieldStar />,
};

const fmtDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export function OperationalDashboard({
  model,
  period,
}: {
  model: DashboardViewData;
  period: number;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const conversionMetric = model.metrics.find((metric) => metric.id === "conversion");
  const totalConverted = model.trend.reduce((total, point) => total + point.converted, 0);

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Dashboard"
        rightSlot={
          <>
            <PeriodSelect
              value={period as 7 | 14 | 30 | 90}
              label="Período do dashboard"
              triggerClassName="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
            />
            <Link href="/relatorios" className={dsButtonVariants({ dsVariant: "outlined-action" })}>
              Relatórios
              <ArrowUpRight data-icon="inline-end" />
            </Link>
            <Link href="/leads" className={dsButtonVariants({ dsVariant: "filled-dark" })}>
              Abrir leads
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </>
        }
      />

      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section aria-labelledby="dashboard-kpi-title">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-md bg-primary/8 text-primary [&>svg]:size-3.5"
              aria-hidden="true"
            >
              <ChartBar />
            </span>
            <h2 id="dashboard-kpi-title" className="text-sm font-semibold text-foreground">
              Resumo do período
            </h2>
            <span className="text-xs text-muted-foreground">
              Indicadores calculados no servidor
            </span>
          </div>
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            initial={reduceMotion ? false : "hidden"}
            animate="visible"
            variants={staggerParent}
          >
            {model.metrics.map((metric) => (
              <motion.div key={metric.id} variants={reduceMotion ? undefined : staggerChild}>
                <DashboardMetricCard
                  metric={metric}
                  icon={metricIcons[metric.id] ?? <ChartBar />}
                />
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="grid gap-5 xl:grid-cols-12" aria-label="Visão principal da operação">
          <div className="min-w-0 xl:col-span-8">
            <TrendPanel trend={model.trend} period={period} />
          </div>
          <div className="min-w-0 xl:col-span-4">
            <AttentionPanel items={model.attention} />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-12" aria-label="Diagnóstico da operação">
          <div className="min-w-0 xl:col-span-8">
            <FunnelPanel
              trend={model.trend}
              totalConverted={totalConverted}
              conversionRate={conversionMetric?.value ?? "—"}
            />
          </div>
          <div className="min-w-0 xl:col-span-4">
            <QualificationPanel rows={model.qualifications} />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2" aria-label="Desempenho por escopo">
          <PerformancePanel
            title="Unidades"
            description="Leads recebidos e convertidos por unidade."
            rows={model.units.map((row) => ({
              id: row.id,
              name: row.name,
              received: row.received,
              suffix: `${row.converted} convertidos`,
            }))}
            valueLabel="Recebidos"
            suffixLabel="Resultado"
          />
          <PerformancePanel
            title="Corretores"
            description="Ranking de recebimento com taxa de conversão."
            rows={model.brokers.map((row) => ({
              id: row.id,
              name: row.name,
              received: row.received,
              suffix: `${row.rate}% conversão`,
            }))}
            valueLabel="Recebidos"
            suffixLabel="Conversão"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-2" aria-label="Atividade recente">
          <RecentPanel
            title="Leads recentes"
            description="Entradas mais recentes no escopo autorizado."
            href="/leads"
            rows={model.recentLeads.map((row) => ({
              id: row.id,
              label: row.name,
              detail: `${statusLabel[row.status] ?? row.status} · ${row.branchName ?? "Sem unidade"}`,
              date: row.createdAt,
            }))}
            emptyLabel="Nenhum lead no período"
            formatDate={fmtDate}
          />
          <RecentPanel
            title="Vendas recentes"
            description="Resultados comerciais registrados no período."
            href="/vendas"
            rows={model.recentSales.map((row) => ({
              id: row.id,
              label: row.leadName,
              detail: row.value
                ? row.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "Venda registrada",
              date: row.saleDate,
            }))}
            emptyLabel="Nenhuma venda no período"
            formatDate={fmtDate}
          />
        </section>
      </main>
    </>
  );
}

function FunnelPanel({
  trend,
  totalConverted,
  conversionRate,
}: {
  trend: DashboardViewData["trend"];
  totalConverted: number;
  conversionRate: string | number;
}) {
  const totalReceived = trend.reduce((total, point) => total + point.received, 0);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3 [&>svg]:size-4"
            aria-hidden="true"
          >
            <TrendUp />
          </span>
          <div>
            <CardTitle>Fluxo comercial</CardTitle>
            <CardDescription>Leads recebidos e convertidos no mesmo ciclo.</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">
            {conversionRate}
            {typeof conversionRate === "number" ? "%" : ""} conversão
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <FlowStat label="Recebidos" value={totalReceived} tone="primary" />
          <FlowStat label="Convertidos" value={totalConverted} tone="success" />
          <FlowStat label="Base do cálculo" value={`${trend.length} dias`} tone="muted" />
        </div>
        <div className="mt-5 grid gap-2" aria-label="Resumo do fluxo">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Entrada</span>
            <span className="font-mono font-medium tabular-nums">{totalReceived}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-chart-1 transition-[width] duration-500 motion-reduce:transition-none"
              style={{
                width: `${totalReceived ? Math.max(4, Math.min(100, (totalConverted / totalReceived) * 100)) : 0}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Conversão</span>
            <span className="font-mono font-medium tabular-nums">{totalConverted}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlowStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "success" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-3",
        tone === "primary" && "border-chart-1/20 bg-chart-1/5",
        tone === "success" && "border-success/20 bg-success/5",
        tone === "muted" && "border-border bg-muted/30",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
