"use client";

/** Dashboard do diretor no visual Lite: "Visão da operação" com filtros de período e unidade. */
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { CommandCenterData } from "@/features/dashboard/today";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import styles from "./director-lite.module.css";
import { OverviewTab } from "./overview-tab";

export type DashboardBranch = { id: string; name: string };

/** Valores de `?periodo=` aceitos por `parseOverviewPeriod`. */
const PERIOD_OPTIONS: Array<{ value: "hoje" | "7" | "30"; period: OverviewPeriod; label: string; days: number }> = [
  { value: "hoje", period: "today", label: "Hoje", days: 1 },
  { value: "7", period: "7d", label: "7 dias", days: 7 },
  { value: "30", period: "30d", label: "30 dias", days: 30 },
];

export function DirectorLiteDashboard({ data, period, branchId, branches, now }: {
  data: CommandCenterData;
  period: OverviewPeriod;
  /** Unidade escolhida já validada contra as unidades do tenant; null = todas. */
  branchId: string | null;
  branches: DashboardBranch[];
  now: Date;
}) {
  const router = useRouter();
  const days = PERIOD_OPTIONS.find((option) => option.period === period)?.days ?? 1;
  const query = (nextPeriod: string, nextBranch: string | null) => {
    const params = new URLSearchParams({ periodo: nextPeriod });
    if (nextBranch) params.set("unidade", nextBranch);
    return `/dashboard?${params.toString()}`;
  };

  return (
    <div className={styles.dashboard}>
      <nav aria-label="Período" className={styles.chipRow}>
        {PERIOD_OPTIONS.map((option) => (
          <Link key={option.value} href={query(option.value, branchId)} className={styles.chip} aria-current={option.period === period ? "true" : undefined}>
            {option.label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Unidade" className={styles.chipRow}>
        <Link href={query(PERIOD_OPTIONS.find((option) => option.period === period)?.value ?? "hoje", null)} className={styles.chip} aria-current={branchId ? undefined : "true"}>
          Todas as unidades
        </Link>
        {branches.map((branch) => (
          <Link
            key={branch.id}
            href={query(PERIOD_OPTIONS.find((option) => option.period === period)?.value ?? "hoje", branch.id)}
            className={styles.chip}
            aria-current={branchId === branch.id ? "true" : undefined}
          >
            {branch.name}
          </Link>
        ))}
      </nav>
      <OverviewTab
        data={data}
        period={period}
        now={now}
        pulse={0}
        freshId={null}
        onDrill={(item) => {
          // Mesmo formato de `drilldownHref` (que fica no servidor): período em dias e unidade, se houver.
          const params = new URLSearchParams({ period: String(days) });
          if (branchId) params.set("branchId", branchId);
          router.push(`/dashboard/drill/${item.id}?${params.toString()}`);
        }}
        onQuality={() => router.push("/dashboard?tab=quality")}
      />
    </div>
  );
}
