"use client";

/** Topo do painel do diretor no visual Lite: saudação, abas, período e unidade. Igual nas abas Visão, Qualidade e Funil. */
import Link from "next/link";
import type { ReactNode } from "react";

import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import styles from "./director-lite.module.css";
import { dateTitle } from "./format";

export type DashboardBranch = { id: string; name: string };
export type DirectorLiteTab = "overview" | "quality";

/** Valores de `?periodo=` aceitos por `parseOverviewPeriod`. */
export const PERIOD_OPTIONS: Array<{ value: "hoje" | "7" | "30"; period: OverviewPeriod; label: string }> = [
  { value: "hoje", period: "today", label: "Hoje" },
  { value: "7", period: "7d", label: "7 dias" },
  { value: "30", period: "30d", label: "30 dias" },
];

/** Monta o link de uma aba ou de um filtro, mantendo período e unidade. */
export function dashboardHref(tab: DirectorLiteTab | "funnel", periodValue: string, branchId: string | null) {
  if (tab === "funnel") return "/dashboard?tab=funnel";
  const params = new URLSearchParams({ periodo: periodValue });
  if (branchId) params.set("unidade", branchId);
  return tab === "quality" ? `/dashboard?tab=quality&${params.toString()}` : `/dashboard?${params.toString()}`;
}

export function DirectorLiteChrome({ now, tab, period, branchId, branches, children }: {
  now: Date;
  tab: DirectorLiteTab;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  children: ReactNode;
}) {
  const periodValue = PERIOD_OPTIONS.find((option) => option.period === period)?.value ?? "hoje";
  const periodLink = (nextPeriod: string, nextBranch: string | null) => dashboardHref(tab, nextPeriod, nextBranch);

  return (
    <div className={styles.dashboard}>
      <header className={styles.stack}>
        <h1 className={styles.pageTitle}>Olá</h1>
        <p className={styles.muted}>{dateTitle(now)}</p>
      </header>
      <nav aria-label="Abas do painel" className={styles.chipRow}>
        <Link href={dashboardHref("overview", periodValue, branchId)} className={styles.chip} aria-current={tab === "overview" ? "page" : undefined}>Visão da operação</Link>
        <Link href={dashboardHref("quality", periodValue, branchId)} className={styles.chip} aria-current={tab === "quality" ? "page" : undefined}>Qualidade dos leads</Link>
        {/* O funil ainda usa a tela antiga; a versão Lite dessa aba é a próxima entrega. */}
        <Link href={dashboardHref("funnel", periodValue, branchId)} className={styles.chip}>Funil de qualificação</Link>
      </nav>
      <nav aria-label="Período" className={styles.chipRow}>
        {PERIOD_OPTIONS.map((option) => (
          <Link key={option.value} href={periodLink(option.value, branchId)} className={styles.chip} aria-current={option.period === period ? "true" : undefined}>
            {option.label}
          </Link>
        ))}
      </nav>
      {branches.length > 0 ? (
        <nav aria-label="Unidade" className={styles.chipRow}>
          <Link href={periodLink(periodValue, null)} className={styles.chip} aria-current={branchId ? undefined : "true"}>
            Todas as unidades
          </Link>
          {branches.map((branch) => (
            <Link key={branch.id} href={periodLink(periodValue, branch.id)} className={styles.chip} aria-current={branchId === branch.id ? "true" : undefined}>
              {branch.name}
            </Link>
          ))}
        </nav>
      ) : null}
      {children}
    </div>
  );
}
