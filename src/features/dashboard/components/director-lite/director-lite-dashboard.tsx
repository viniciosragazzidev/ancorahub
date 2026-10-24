"use client";

/** Dashboard do diretor no visual Lite: "Visão da operação" com filtros de período e unidade. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { CommandCenterData } from "@/features/dashboard/today";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import styles from "./director-lite.module.css";
import { dateTitle } from "./format";
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
  const [pulse, setPulse] = useState(0);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const seenLeads = useRef<Set<string> | null>(null);

  // Lead novo: a atualização do servidor (router.refresh do RealtimeSyncProvider) traz leads que a tela ainda não tinha.
  // Só compara as duas últimas respostas; não chama refresh, então não há laço.
  useEffect(() => {
    const ids = data.recentLeads.map((lead) => lead.id);
    const previous = seenLeads.current;
    seenLeads.current = new Set(ids);
    if (!previous) return;
    const fresh = data.recentLeads.find((lead) => !previous.has(lead.id));
    if (!fresh) return;
    setFreshId(fresh.id);
    setPulse((value) => value + 1);
    setAnnouncement(`Novo lead: ${fresh.name}`);
  }, [data]);

  const days = PERIOD_OPTIONS.find((option) => option.period === period)?.days ?? 1;
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
        <Link href={query(PERIOD_OPTIONS[0]!.value, branchId)} className={styles.chip} aria-current="page">Visão da operação</Link>
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
      ) : null}
      <OverviewTab
        data={data}
        period={period}
        now={now}
        pulse={pulse}
        freshId={freshId}
        onDrill={(item) => {
          // Mesmo formato de `drilldownHref` (que fica no servidor): período em dias e unidade, se houver.
          const params = new URLSearchParams({ period: String(days) });
          if (branchId) params.set("branchId", branchId);
          router.push(`/dashboard/drill/${item.id}?${params.toString()}`);
        }}
        onQuality={() => router.push("/dashboard?tab=quality")}
      />
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </div>
  );
}
