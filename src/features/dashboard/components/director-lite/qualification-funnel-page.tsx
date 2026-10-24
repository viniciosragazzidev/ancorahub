"use client";

import { useRouter } from "next/navigation";

import type { FunnelPeriod, QualificationFunnel } from "@/features/qualification-turbo/funnel";

import type { DashboardBranch } from "./director-lite-dashboard";
import { DirectorLiteHeader, type HeaderOption, type HeaderUnit } from "./director-lite-header";
import styles from "./director-lite.module.css";
import { QualificationFunnelView } from "./qualification-funnel-view";

const periods: readonly FunnelPeriod[] = [7, 30, 90];

function funnelHref(period: FunnelPeriod, branchId: string | null) {
  const params = new URLSearchParams({ tab: "funnel", period: String(period) });
  if (branchId) params.set("unidade", branchId);
  return `/dashboard?${params.toString()}`;
}

function standardPeriod(period: FunnelPeriod) {
  return period === 7 ? "7" : "30";
}

function overviewHref(period: FunnelPeriod, branchId: string | null) {
  const params = new URLSearchParams({ periodo: standardPeriod(period) });
  if (branchId) params.set("unidade", branchId);
  return `/dashboard?${params.toString()}`;
}

function qualityHref(period: FunnelPeriod, branchId: string | null) {
  const params = new URLSearchParams({ tab: "quality", periodo: standardPeriod(period) });
  if (branchId) params.set("unidade", branchId);
  return `/dashboard?${params.toString()}`;
}

export function DirectorLiteQualificationFunnelPage({
  data,
  branchId,
  branches,
  firstName,
  now,
}: {
  data: QualificationFunnel;
  /** Unidade já validada no servidor; null representa todas as unidades autorizadas. */
  branchId: string | null;
  branches: DashboardBranch[];
  firstName: string | null;
  now: Date;
}) {
  const router = useRouter();
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;
  const tabs: HeaderOption[] = [
    { value: "overview", label: "Visão da operação", href: overviewHref(data.period, branchId) },
    { value: "quality", label: "Qualidade dos leads", href: qualityHref(data.period, branchId) },
    { value: "funnel", label: "Funil de qualificação", href: funnelHref(data.period, branchId) },
  ];
  const periodOptions: HeaderOption[] = periods.map((period) => ({
    value: String(period),
    label: `${period} dias`,
    href: funnelHref(period, branchId),
  }));
  const units: HeaderUnit[] | undefined = branches.length
    ? [{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]
    : undefined;

  return (
    <div className={styles.dashboard}>
      <DirectorLiteHeader
        firstName={firstName}
        now={now}
        tabs={tabs}
        activeTab="funnel"
        periods={periodOptions}
        activePeriod={String(data.period)}
        units={units}
        activeUnit={branchId ?? ""}
        onUnit={(value) => router.push(funnelHref(data.period, value || null))}
      />
      <QualificationFunnelView data={data} unitName={selectedBranch?.name ?? null} />
    </div>
  );
}
