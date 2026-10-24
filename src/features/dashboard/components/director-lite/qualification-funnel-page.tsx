import Link from "next/link";

import type { FunnelPeriod, QualificationFunnel } from "@/features/qualification-turbo/funnel";

import type { DashboardBranch } from "./director-lite-dashboard";
import styles from "./director-lite.module.css";
import { QualificationFunnelView } from "./qualification-funnel-view";

const periods: readonly FunnelPeriod[] = [7, 30, 90];

function funnelHref(period: FunnelPeriod, branchId: string | null) {
  const params = new URLSearchParams({ tab: "funnel", period: String(period) });
  if (branchId) params.set("unidade", branchId);
  return `/dashboard?${params.toString()}`;
}

function overviewHref(period: FunnelPeriod, branchId: string | null) {
  const overviewPeriod = period === 7 ? "7" : "30";
  const params = new URLSearchParams({ periodo: overviewPeriod });
  if (branchId) params.set("unidade", branchId);
  return `/dashboard?${params.toString()}`;
}

export function DirectorLiteQualificationFunnelPage({
  data,
  branchId,
  branches,
}: {
  data: QualificationFunnel;
  /** Unidade já validada no servidor; null representa todas as unidades autorizadas. */
  branchId: string | null;
  branches: DashboardBranch[];
}) {
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;

  return (
    <main className={`${styles.dashboard} ${styles.funnelPage}`}>
      <header className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>Funil de qualificação</h1>
          <p className={styles.pageSubtitle}>
            Acompanhe a mesma turma de leads da chegada à venda nos últimos {data.period} dias.
          </p>
        </div>
      </header>

      <nav aria-label="Abas do painel" className={styles.chipRow}>
        <Link href={overviewHref(data.period, branchId)} className={styles.chip}>Visão da operação</Link>
        <Link href="/dashboard?tab=quality" className={styles.chip}>Qualidade dos leads</Link>
        <Link href={funnelHref(data.period, branchId)} className={styles.chip} aria-current="page">Funil de qualificação</Link>
      </nav>

      <nav aria-label="Período" className={styles.chipRow}>
        {periods.map((period) => (
          <Link
            key={period}
            href={funnelHref(period, branchId)}
            className={styles.chip}
            aria-current={data.period === period ? "true" : undefined}
          >
            {period} dias
          </Link>
        ))}
      </nav>

      {branches.length > 0 ? (
        <nav aria-label="Unidade" className={styles.chipRow}>
          <Link href={funnelHref(data.period, null)} className={styles.chip} aria-current={branchId ? undefined : "true"}>
            Todas as unidades
          </Link>
          {branches.map((branch) => (
            <Link
              key={branch.id}
              href={funnelHref(data.period, branch.id)}
              className={styles.chip}
              aria-current={branchId === branch.id ? "true" : undefined}
            >
              {branch.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <QualificationFunnelView data={data} unitName={selectedBranch?.name ?? null} />
    </main>
  );
}
