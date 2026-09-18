"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  ChartBar,
  CheckCircle,
  ShieldStar,
  TrendUp,
  Users,
  Warning,
} from "@/components/huge-icons";
import { PeriodSelect } from "@/components/period-select";
import { DsPageHeader } from "@/components/ui/ds-page-header";
import { DsDashboardCard } from "@/components/ui/ds-dashboard-card";
import { DsStatTile } from "@/components/ui/ds-stat-tile";
import { DsStatusBadge, type DsStatusBadgeStatus } from "@/components/ui/ds-status-badge";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsBarChart } from "@/components/ui/ds-bar-chart";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";
import { cn } from "@/lib/utils";
import type { DashboardViewData } from "../service";

const statusLabel: Record<string, string> = { new: "Novo", distributed: "Distribuído", in_contact: "Em atendimento", quote_sent: "Proposta", negotiation: "Negociação", converted: "Convertido", lost: "Perdido" };
const qualificationLabel: Record<string, string> = { qualified: "Qualificado", hot: "Quente", warm: "Morno", cold: "Frio", pending: "Pendente", qualifying: "Em qualificação", disqualified: "Desqualificado" };
const qualificationStatus: Record<string, DsStatusBadgeStatus> = { hot: "destructive", warm: "warning", cold: "info", qualified: "success", pending: "secondary", qualifying: "info", disqualified: "secondary" };
const fmtDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

// Reuses the app's existing motion vocabulary (same stagger/easing idiom as
// DistributionMetrics in distribution-dashboard.tsx) instead of inventing a
// new one — docs/design-system.md doesn't define motion tokens, so this
// stays consistent with what's already shipped elsewhere in the product.
const staggerParent = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};
const staggerChild = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] as const } },
};

export function OperationalDashboard({ model, period }: { model: DashboardViewData; period: number }) {
  const totalConverted = model.trend.reduce((total, point) => total + point.converted, 0);
  const bestDay = model.trend.reduce((best, point) => (point.received > best.received ? point : best), model.trend[0] ?? { date: "", received: 0, converted: 0 });
  const attentionMetric = model.metrics.find((metric) => metric.id === "attention");
  const hasAttention = Number(attentionMetric?.value ?? 0) > 0;

  return (
    <>
      <DsPageHeader
        title="Dashboard"
        breadcrumb="Operação comercial"
        description={model.header.description}
        context={
          <DsStatusBadge
            status={hasAttention ? "warning" : "success"}
            label={hasAttention ? `${attentionMetric?.value ?? 0} exceções` : "Sem exceções"}
          />
        }
        actions={
          <>
            <PeriodSelect
              value={period as 7 | 14 | 30 | 90}
              label="Período do dashboard"
              triggerClassName="rounded-ds-buttons border border-ds-ash bg-ds-canvas-white px-ds-12 py-ds-8 font-ds-inter text-ds-body text-ds-charcoal hover:bg-ds-paper-mist"
            />
            <Link href="/relatorios" className={dsButtonVariants({ dsVariant: "outlined-action" })}>
              Relatórios
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/leads" className={dsButtonVariants({ dsVariant: "filled-dark" })}>
              Abrir leads
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </>
        }
      />
      <main className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col gap-ds-32 px-ds-16 py-ds-24 lg:px-ds-32">
        <p className="flex flex-wrap items-center gap-ds-8 font-ds-inter text-ds-caption text-ds-fog">
          <span>Últimos {period} dias</span>
          <span aria-hidden="true" className="text-ds-ash">•</span>
          {bestDay?.date ? `Pico de ${bestDay.received} leads em ${fmtDayLabel(bestDay.date)}` : "Sem pico no período"}
        </p>

        <section aria-label="Indicadores do período">
          <SectionLabel icon={<ChartBar className="size-3.5" aria-hidden="true" />} title="Resumo do período" hint={`${model.trend.length} dias no ciclo`} />
          <motion.div
            className="grid grid-cols-2 gap-ds-16 sm:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={staggerParent}
          >
            {model.metrics.map((metric) => (
              <motion.div key={metric.id} variants={staggerChild}>
                <DsDashboardCard className="p-ds-16">
                  <DsStatTile
                    label={metric.label}
                    value={metric.value}
                    tone={metric.tone === "warning" ? "warning" : metric.tone === "success" ? "success" : "default"}
                  />
                  <p className="mt-ds-8 truncate font-ds-inter text-ds-caption text-ds-fog">{metric.description}</p>
                </DsDashboardCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section aria-label="Volume e atenção" className="grid gap-ds-24 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0">
            <SectionLabel icon={<TrendUp className="size-3.5" aria-hidden="true" />} title="Leads recebidos" hint={`${totalConverted} convertidos no ciclo`} />
            <DsDashboardCard className="p-ds-16 sm:p-ds-20">
              <TrendChart trend={model.trend} />
            </DsDashboardCard>
          </div>
          <div className="min-w-0">
            <SectionLabel icon={<Warning className="size-3.5" aria-hidden="true" />} title="Atenção agora" hint="Exceções do período" />
            <AttentionPanel items={model.attention} />
          </div>
        </section>

        <section aria-label="Desempenho por unidade e corretor" className="grid gap-ds-24 lg:grid-cols-2">
          <div className="min-w-0">
            <SectionLabel icon={<Users className="size-3.5" aria-hidden="true" />} title="Unidades por leads recebidos" hint="Ranking do período" />
            <RankCard rows={model.units.map((row) => ({ label: row.name, value: row.received, suffix: `${row.converted} convertidos` }))} />
          </div>
          <div className="min-w-0">
            <SectionLabel icon={<ShieldStar className="size-3.5" aria-hidden="true" />} title="Top corretores" hint="Recebidos e conversão" />
            <RankCard rows={model.brokers.map((row) => ({ label: row.name, value: row.received, suffix: `${row.rate}% conversão` }))} />
          </div>
        </section>

        <section aria-label="Qualificações e atividade recente" className="grid gap-ds-24 lg:grid-cols-3">
          <div className="min-w-0">
            <SectionLabel icon={<ChartBar className="size-3.5" aria-hidden="true" />} title="Qualificações" hint="Distribuição do período" />
            <DsDashboardCard className="p-ds-16">
              {model.qualifications.length ? (
                <ul className="flex flex-col gap-ds-12">
                  {model.qualifications.map((row) => (
                    <li key={row.status} className="flex items-center justify-between gap-ds-12">
                      <span className="truncate font-ds-inter text-ds-body text-ds-charcoal">{qualificationLabel[row.status] ?? row.status}</span>
                      <DsStatusBadge status={qualificationStatus[row.status] ?? "secondary"} label={row.count} />
                    </li>
                  ))}
                </ul>
              ) : (
                <DsEmptyState title="Nenhuma qualificação no período." bordered={false} className="py-ds-16" />
              )}
            </DsDashboardCard>
          </div>
          <div className="min-w-0">
            <SectionLabel icon={<Users className="size-3.5" aria-hidden="true" />} title="Últimos leads" hint="Entradas recentes" />
            <RecentCard href="/leads" rows={model.recentLeads.map((row) => ({ id: row.id, label: row.name, detail: `${statusLabel[row.status] ?? row.status} · ${row.branchName ?? "Sem unidade"}`, date: fmtDate(row.createdAt) }))} emptyLabel="Nenhum lead no período." />
          </div>
          <div className="min-w-0">
            <SectionLabel icon={<TrendUp className="size-3.5" aria-hidden="true" />} title="Últimas vendas" hint="Resultados recentes" />
            <RecentCard href="/vendas" rows={model.recentSales.map((row) => ({ id: row.id, label: row.leadName, detail: row.value ? row.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Venda registrada", date: fmtDate(row.saleDate) }))} emptyLabel="Nenhuma venda no período." />
          </div>
        </section>
      </main>
    </>
  );
}

function SectionLabel({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-ds-12 flex flex-wrap items-baseline gap-x-ds-8 gap-y-1">
      <span aria-hidden="true" className="translate-y-0.5 text-ds-fog">{icon}</span>
      <h2 className="font-ds-inter text-ds-body font-semibold text-ds-charcoal">{title}</h2>
      <span className="font-ds-inter text-ds-caption text-ds-fog">{hint}</span>
    </div>
  );
}

function TrendChart({ trend }: { trend: DashboardViewData["trend"] }) {
  if (!trend.length) {
    return (
      <DsEmptyState
        title="Sem recebimentos no período"
        description="As barras aparecem conforme os leads chegam."
        bordered={false}
        className="py-ds-32"
      />
    );
  }

  return (
    <DsBarChart
      data={trend}
      xKey="date"
      series={[
        { key: "received", label: "Recebidos" },
        { key: "converted", label: "Convertidos" },
      ]}
      xTickFormatter={(value: string) => value.slice(8)}
    />
  );
}

function AttentionPanel({ items }: { items: DashboardViewData["attention"] }) {
  if (!items.length) {
    return (
      <DsDashboardCard className="p-ds-20">
        <DsEmptyState
          icon={<CheckCircle size={20} aria-hidden="true" />}
          title="Nenhuma exceção operacional"
          description="SLA, distribuição e follow-ups estão dentro do esperado para o período."
          bordered={false}
        />
      </DsDashboardCard>
    );
  }

  return (
    <DsDashboardCard className="divide-y divide-ds-ash overflow-hidden !p-0">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="group flex items-center justify-between gap-ds-12 px-ds-16 py-ds-12 transition-colors hover:bg-ds-paper-mist"
        >
          <span className="flex min-w-0 items-center gap-ds-8">
            <span
              aria-hidden="true"
              className={cn("size-1.5 shrink-0 rounded-full", item.tone === "danger" ? "bg-ds-rose-ink" : "bg-ds-amber-ink")}
            />
            <span className="truncate font-ds-inter text-ds-body font-medium text-ds-charcoal">{item.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-ds-8">
            <DsStatusBadge status={item.tone === "danger" ? "destructive" : "warning"} label={item.count} />
            <ArrowUpRight
              size={14}
              className="text-ds-fog transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </span>
        </Link>
      ))}
    </DsDashboardCard>
  );
}

function RankCard({ rows }: { rows: Array<{ label: string; value: number; suffix: string }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <DsDashboardCard className="p-ds-16">
      {rows.length ? (
        <ol className="flex flex-col gap-ds-16">
          {rows.slice(0, 6).map((row, index) => (
            <li key={row.label}>
              <div className="flex items-baseline justify-between gap-ds-12">
                <span className="flex min-w-0 items-baseline gap-ds-8">
                  <span aria-hidden="true" className="w-4 shrink-0 text-right font-ds-mono text-ds-caption text-ds-silver">
                    {index + 1}
                  </span>
                  <span className="truncate font-ds-inter text-ds-body font-medium text-ds-charcoal">{row.label}</span>
                </span>
                <span className="shrink-0 font-ds-mono text-ds-body font-semibold tabular-nums text-ds-charcoal">{row.value}</span>
              </div>
              <div className="mt-ds-8 flex items-center gap-ds-8 pl-ds-16">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-ds-tags bg-ds-paper-mist">
                  <motion.div
                    className="h-full rounded-ds-tags bg-ds-electric-blue"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 }}
                  />
                </div>
                <span className="shrink-0 font-ds-inter text-ds-caption text-ds-fog">{row.suffix}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <DsEmptyState title="Nenhum dado no período." bordered={false} className="py-ds-16" />
      )}
    </DsDashboardCard>
  );
}

function RecentCard({
  href,
  rows,
  emptyLabel,
}: {
  href: string;
  rows: Array<{ id: string; label: string; detail: string; date: string }>;
  emptyLabel: string;
}) {
  return (
    <DsDashboardCard className="divide-y divide-ds-ash overflow-hidden !p-0">
      {rows.length ? (
        rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-ds-12 px-ds-16 py-ds-12">
            <div className="min-w-0">
              <p className="truncate font-ds-inter text-ds-body font-medium text-ds-charcoal">{row.label}</p>
              <p className="truncate font-ds-inter text-ds-caption text-ds-fog">{row.detail}</p>
            </div>
            <time className="shrink-0 font-ds-inter text-ds-caption text-ds-fog">{row.date}</time>
          </div>
        ))
      ) : (
        <DsEmptyState title={emptyLabel} bordered={false} className="py-ds-24" />
      )}
      <Link
        href={href}
        className="flex items-center justify-center gap-ds-4 px-ds-16 py-ds-12 font-ds-inter text-ds-caption font-medium text-ds-electric-blue transition-colors hover:bg-ds-paper-mist"
      >
        Ver todos
        <ArrowUpRight size={14} aria-hidden="true" />
      </Link>
    </DsDashboardCard>
  );
}

function fmtDayLabel(date: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}
