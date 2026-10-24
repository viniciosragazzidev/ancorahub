"use client";

/** Dashboard do diretor no visual Lite: painel essencial (plantões, leads por fila, WhatsApp dos corretores) com período e unidade. */
import Link from "next/link";

import type { EssentialDashboard } from "@/features/dashboard/essential/essential-data";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import styles from "./director-lite.module.css";
import { dateTitle } from "./format";
import { EssentialView } from "./essential-view";

export type DashboardBranch = { id: string; name: string };

/** Valores de `?periodo=` aceitos por `parseOverviewPeriod`. */
const PERIOD_OPTIONS: Array<{ value: "hoje" | "7" | "30"; period: OverviewPeriod; label: string }> = [
  { value: "hoje", period: "today", label: "Hoje" },
  { value: "7", period: "7d", label: "7 dias" },
  { value: "30", period: "30d", label: "30 dias" },
];

export function DirectorLiteDashboard({ data, period, branchId, branches, now }: {
  data: EssentialDashboard;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  now: Date;
}) {
  const periodValue = PERIOD_OPTIONS.find((option) => option.period === period)?.value ?? "hoje";
  const query = (nextPeriod: string, nextBranch: string | null) => {
    const params = new URLSearchParams({ periodo: nextPeriod });
    if (nextBranch) params.set("unidade", nextBranch);
    return `/dashboard?${params.toString()}`;
  };

  return (
    <div className={styles.dashboard}>
      <header className={styles.stack}>
        <h1 className={styles.pageTitle}>Olá</h1>
        <p className={styles.muted}>{dateTitle(now)}</p>
      </header>
      <nav aria-label="Abas do painel" className={styles.chipRow}>
        <Link href={query(periodValue, branchId)} className={styles.chip} aria-current="page">Visão da operação</Link>
        {/* Qualidade e funil ainda usam as telas antigas; a versão Lite dessas abas é a próxima entrega. */}
        <Link href="/dashboard?tab=quality" className={styles.chip}>Qualidade dos leads</Link>
        <Link href="/dashboard?tab=funnel" className={styles.chip}>Funil de qualificação</Link>
      </nav>
      <nav aria-label="Período" className={styles.chipRow}>
        {PERIOD_OPTIONS.map((option) => (
          <Link key={option.value} href={query(option.value, branchId)} className={styles.chip} aria-current={option.period === period ? "true" : undefined}>
            {option.label}
          </Link>
        ))}
      </nav>
      {branches.length > 0 ? (
        <nav aria-label="Unidade" className={styles.chipRow}>
          <Link href={query(periodValue, null)} className={styles.chip} aria-current={branchId ? undefined : "true"}>
            Todas as unidades
          </Link>
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={query(periodValue, branch.id)}
              className={styles.chip}
              aria-current={branchId === branch.id ? "true" : undefined}
            >
              {branch.name}
            </Link>
          ))}
        </nav>
      ) : null}
      <p className={styles.hint}>O período muda só os leads por fila. Plantões e WhatsApp mostram agora.</p>
      <EssentialView data={data} />
    </div>
  );
}
