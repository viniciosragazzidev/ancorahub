"use client";

import { PageTabs, type PageTabItem } from "@/components/foundations/page-tabs";
import type { PeriodValue } from "@/shared/period";

const dashboardTabs: readonly PageTabItem[] = [
  { id: "overview", label: "Visão da operação" },
  { id: "quality", label: "Qualidade dos leads" },
];

export function DashboardSectionTabs({
  active,
  period,
  showQuality = true,
}: {
  active: "overview" | "quality";
  /** "today" exists only on the quality tab; the overview falls back to its default. */
  /** A quality range ("2026-10-01_2026-10-13") only travels to the quality tab. */
  period: PeriodValue | 3 | "today" | `${string}_${string}`;
  showQuality?: boolean;
}) {
  const tabs = showQuality ? dashboardTabs : dashboardTabs.slice(0, 1);

  return (
    <PageTabs
      tabs={tabs}
      active={active}
      className="border-b border-border/70 pb-3"
      hrefBuilder={(tabId) => {
        const params = new URLSearchParams();
        if (tabId === "quality") params.set("tab", "quality");
        if (period !== 30 && (tabId === "quality" || (period !== "today" && !String(period).includes("_")))) params.set("period", String(period));
        const query = params.toString();
        return query ? `/dashboard?${query}` : "/dashboard";
      }}
    />
  );
}
