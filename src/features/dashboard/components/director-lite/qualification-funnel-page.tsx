"use client";

import type { FunnelPeriod, QualificationFunnel } from "@/features/qualification-turbo/funnel";
import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import type { DashboardBranch } from "./director-lite-dashboard";
import { dashboardHref, DirectorLiteChrome } from "./director-lite-chrome";
import { QualificationFunnelView } from "./qualification-funnel-view";

function overviewPeriod(period: FunnelPeriod): OverviewPeriod {
  if (period === "today") return "today";
  return period === 7 ? "7d" : "30d";
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
  const selectedBranch = branches.find((branch) => branch.id === branchId) ?? null;
  const period = overviewPeriod(data.period);

  return (
    <DirectorLiteChrome now={now} tab="funnel" period={period} branchId={branchId} branches={branches} firstName={firstName}>
      <QualificationFunnelView data={data} unitName={selectedBranch?.name ?? null} widerHref={dashboardHref("funnel", "7", branchId)} />
    </DirectorLiteChrome>
  );
}
