"use client";

/** Topo do painel do diretor no visual Lite nas abas Visão, Qualidade e Funil: o cabeçalho compartilhado com os links reais. */
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import type { ReactNode } from "react";

import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import { DirectorLiteHeader } from "./director-lite-header";
import styles from "./director-lite.module.css";

export type DashboardBranch = { id: string; name: string };
export type DirectorLiteTab = "overview" | "quality" | "funnel";

/** Valores de `?periodo=` aceitos por `parseOverviewPeriod`. */
export const PERIOD_OPTIONS: Array<{ value: "hoje" | "7" | "30"; period: OverviewPeriod; label: string }> = [
  { value: "hoje", period: "today", label: "Hoje" },
  { value: "7", period: "7d", label: "7 dias" },
  { value: "30", period: "30d", label: "30 dias" },
];

const TAB_BASE: Record<DirectorLiteTab, string> = { overview: "/dashboard", quality: "/dashboard?tab=quality", funnel: "/dashboard?tab=funnel" };

/** Link de uma aba ou de um filtro: mantém período e unidade (o único ponto que monta essas rotas). */
export function dashboardHref(tab: DirectorLiteTab, periodValue: string, branchId: string | null) {
  const params = new URLSearchParams({ periodo: periodValue });
  if (branchId) params.set("unidade", branchId);
  return `${TAB_BASE[tab]}${TAB_BASE[tab].includes("?") ? "&" : "?"}${params.toString()}`;
}

export function DirectorLiteChrome({ now, tab, period, branchId, branches, firstName, availableTabs, children }: {
  now: Date;
  tab: DirectorLiteTab;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  firstName: string | null;
  /** Abas que este usuário abre (ver liteDashboardTabs). Sem isto, as três: o diretor com a central de qualidade. */
  availableTabs?: readonly DirectorLiteTab[];
  children: ReactNode;
}) {
  const router = useRouter();
  const periodValue = PERIOD_OPTIONS.find((option) => option.period === period)?.value ?? "hoje";
  const tabs = [
    { value: "overview", label: "Visão da operação", short: "Operação", href: dashboardHref("overview", periodValue, branchId) },
    { value: "quality", label: "Qualidade dos leads", short: "Qualidade", href: dashboardHref("quality", periodValue, branchId) },
    { value: "funnel", label: "Funil de qualificação", short: "Funil", href: dashboardHref("funnel", periodValue, branchId) },
  ].filter((item) => !availableTabs || availableTabs.includes(item.value as DirectorLiteTab));
  const periods = PERIOD_OPTIONS.map((option) => ({ value: option.value, label: option.label, href: dashboardHref(tab, option.value, branchId) }));
  const units = branches.length ? [{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))] : undefined;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <DashboardHeader breadcrumb="Início" title="Painel" />
      <main className={styles.pageContainer} aria-label="Painel">
        <div className={styles.dashboard}>
          <DirectorLiteHeader
            firstName={firstName}
            now={now}
            tabs={tabs.length > 1 ? tabs : []}
            activeTab={tab}
            periods={periods}
            activePeriod={periodValue}
            units={units}
            activeUnit={branchId ?? ""}
            onUnit={(value) => router.push(dashboardHref(tab, periodValue, value || null))}
          />
          {children}
        </div>
      </main>
    </div>
  );
}
