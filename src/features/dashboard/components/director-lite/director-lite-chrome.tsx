"use client";

/** Topo do painel do diretor no visual Lite nas abas Visão, Qualidade e Funil: o cabeçalho compartilhado com os links reais. */
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import { DirectorLiteHeader } from "./director-lite-header";
import { customRangeLabel, rangeParam, type CustomRange } from "./custom-range";
import styles from "./painel.module.css";

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
export function dashboardHref(tab: DirectorLiteTab, periodValue: string, branchId: string | null, queueId?: string | null) {
  const params = new URLSearchParams({ periodo: periodValue });
  if (branchId) params.set("unidade", branchId);
  if (queueId) params.set("fila", queueId);
  return `${TAB_BASE[tab]}${TAB_BASE[tab].includes("?") ? "&" : "?"}${params.toString()}`;
}

export function DirectorLiteChrome({ now, tab, period, branchId, branches, firstName, availableTabs, queues, queueId = null, customRange = null, allowCustomRange = false, headline = null, action = null, children }: {
  /** Frase da situação abaixo da saudação (27/11/2026). */
  headline?: string | null;
  /** Ação do momento no topo (o botão "Precisa de você" da visão geral). */
  action?: ReactNode;
  now: Date;
  tab: DirectorLiteTab;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  firstName: string | null;
  /** Abas que este usuário abre (ver liteDashboardTabs). Sem isto, as três: o diretor com a central de qualidade. */
  availableTabs?: readonly DirectorLiteTab[];
  /**
   * Filtro por fila no lugar da unidade (Qualidade e Funil, 20/11/2026: "intervalo e fila, nada mais").
   * Com `queues`, o seletor vira "Todas as filas" + filas e escreve `?fila=`.
   */
  queues?: DashboardBranch[];
  queueId?: string | null;
  /** Intervalo personalizado ativo (`?periodo=AAAA-MM-DDTHH:MM_AAAA-MM-DDTHH:MM`). Com `allowCustomRange`, aparece "Personalizado". */
  customRange?: CustomRange | null;
  allowCustomRange?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const rangeValue = customRange ? rangeParam(customRange) : null;
  const periodValue = rangeValue ?? PERIOD_OPTIONS.find((option) => option.period === period)?.value ?? "hoje";
  const tabs = [
    { value: "overview", label: "Visão geral", short: "Geral", href: dashboardHref("overview", periodValue, branchId) },
    { value: "quality", label: "Qualidade dos leads", short: "Qualidade", href: dashboardHref("quality", periodValue, branchId) },
    { value: "funnel", label: "Funil", short: "Funil", href: dashboardHref("funnel", periodValue, branchId) },
  ].filter((item) => !availableTabs || availableTabs.includes(item.value as DirectorLiteTab));
  const byQueue = Boolean(queues);
  const periods = PERIOD_OPTIONS.map((option) => ({ value: option.value, label: option.label, href: dashboardHref(tab, option.value, branchId, queueId) }));
  // Resumo de uma linha (skill `interface-enxuta`): o recorte já escolhido, período e unidade.
  const periodText = customRange ? customRangeLabel(customRange) : periodValue === "hoje" ? "Hoje" : `Últimos ${periodValue} dias`;
  const summary = byQueue
    ? `${periodText} · ${queues?.find((queue) => queue.id === queueId)?.name ?? "Todas as filas"}`
    : branches.length ? `${periodText} · ${branches.find((branch) => branch.id === branchId)?.name ?? "Todas as unidades"}` : periodText;
  const units = byQueue
    ? [{ value: "", label: "Todas as filas" }, ...(queues ?? []).map((queue) => ({ value: queue.id, label: queue.name }))]
    : branches.length ? [{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))] : undefined;

  return (
    // Cópia 1:1 do artifact (27/11/2026): sem a faixa de topo do app nem as abas da área; a página começa nas abas.
    <div className={`${styles.gx} flex min-h-0 min-w-0 flex-1 flex-col`} data-painel="lite">
      <main className={styles.main} aria-label="Painel">
        <div className={styles.column}>
          <DirectorLiteHeader
            summary={summary}
            firstName={firstName}
            now={now}
            tabs={tabs.length > 1 ? tabs : []}
            activeTab={tab}
            periods={periods}
            activePeriod={periodValue}
            units={units}
            unitLabel={byQueue ? "Fila" : "Unidade"}
            activeUnit={(byQueue ? queueId : branchId) ?? ""}
            onUnit={(value) => router.push(byQueue ? dashboardHref(tab, periodValue, branchId, value || null) : dashboardHref(tab, periodValue, value || null))}
            customRange={customRange}
            onCustomRange={allowCustomRange ? (range) => router.push(dashboardHref(tab, rangeParam(range), branchId, queueId)) : undefined}
            headline={headline}
            action={action}
          />
          {children}
        </div>
      </main>
    </div>
  );
}
