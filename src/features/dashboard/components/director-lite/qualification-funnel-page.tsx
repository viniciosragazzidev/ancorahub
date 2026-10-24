"use client";

import { useRouter } from "next/navigation";

import type { FunnelPeriod, QualificationFunnel } from "@/features/qualification-turbo/funnel";

import type { DashboardBranch } from "./director-lite-dashboard";
import { dashboardHref, PERIOD_OPTIONS } from "./director-lite-chrome";
import { DirectorLiteHeader, type HeaderOption, type HeaderUnit } from "./director-lite-header";
import styles from "./director-lite.module.css";
import { QualificationFunnelView } from "./qualification-funnel-view";

function periodValue(period: FunnelPeriod) {
  if (period === "today") return "hoje";
  return period === 7 ? "7" : "30";
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
  const activePeriod = periodValue(data.period);
  const tabs: HeaderOption[] = [
    { value: "overview", label: "Visão da operação", href: dashboardHref("overview", activePeriod, branchId) },
    { value: "quality", label: "Qualidade dos leads", href: dashboardHref("quality", activePeriod, branchId) },
    { value: "funnel", label: "Funil de qualificação", href: dashboardHref("funnel", activePeriod, branchId) },
  ];
  const periodOptions: HeaderOption[] = PERIOD_OPTIONS.map((period) => ({
    value: period.value,
    label: period.label,
    href: dashboardHref("funnel", period.value, branchId),
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
        activePeriod={activePeriod}
        units={units}
        activeUnit={branchId ?? ""}
        onUnit={(value) => router.push(dashboardHref("funnel", activePeriod, value || null))}
      />
      <QualificationFunnelView data={data} unitName={selectedBranch?.name ?? null} />
    </div>
  );
}
