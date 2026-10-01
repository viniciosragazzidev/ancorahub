"use client";

import { Buildings, Users } from "@/components/huge-icons";
import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { DashboardSectionTabs } from "./dashboard-section-tabs";
import type { DashboardViewData } from "../service";
import {
  AttentionGrid,
  FlowCard,
  FunnelCard,
  KpiStrip,
  RankingCard,
  RecentLeadsCard,
  ShortcutGrid,
  WelcomeHero,
} from "./dashboard-widgets";

/**
 * The operational dashboard, laid out like the Gravura overview: a welcome
 * band, one strip of numbers, then pairs of parts (work + exceptions, flow +
 * funnel, units + brokers) and a lattice of shortcuts. Styling stays the
 * project's design system (docs/design-system.md).
 */
export function OperationalDashboard({
  model,
  period,
  showQualityTab = false,
}: {
  model: DashboardViewData;
  period: number;
  showQualityTab?: boolean;
}) {
  const now = new Date(model.generatedAt);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const pending = model.attention.reduce((total, item) => total + item.count, 0);
  const summary = pending
    ? `${pending} ${pending === 1 ? "pendência pede" : "pendências pedem"} atenção agora. Os números abaixo são dos últimos ${period} dias.`
    : `Nada pendente na distribuição. Os números abaixo são dos últimos ${period} dias.`;

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Dashboard"
        rightSlot={
          <PeriodSelect
            value={period as 7 | 14 | 30 | 90}
            label="Período do dashboard"
            triggerClassName="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
          />
        }
      />

      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <DashboardSectionTabs active="overview" period={period as 7 | 14 | 30 | 90} showQuality={showQualityTab} />
        <WelcomeHero welcome={model.welcome} dateLabel={dateLabel} summary={summary} />

        <section aria-label="Resumo do período">
          <KpiStrip metrics={model.metrics} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]" aria-label="Trabalho e exceções">
          <RecentLeadsCard rows={model.recentLeads} now={now} />
          <AttentionGrid items={model.attention} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]" aria-label="Fluxo e funil">
          <FlowCard trend={model.trend} period={period} />
          <FunnelCard funnel={model.funnel} />
        </section>

        <section className="grid gap-5 xl:grid-cols-2" aria-label="Desempenho por escopo">
          <RankingCard
            title="Unidades"
            icon={<Buildings />}
            href="/unidades"
            linkLabel="Unidades"
            rateLabel="Resultado"
            rows={model.units.map((row) => ({
              ...row,
              rate: row.received ? Math.round((row.converted / row.received) * 1000) / 10 : 0,
            }))}
          />
          <RankingCard
            title="Corretores"
            icon={<Users />}
            href="/equipe"
            linkLabel="Equipe"
            rateLabel="Conversão"
            rows={model.brokers}
          />
        </section>

        <ShortcutGrid />
      </main>
    </>
  );
}
