"use client";

import { PageTabs } from "@/components/foundations/page-tabs";
import type { ReportTabId } from "@/features/reports/metrics/metric-catalog";

const TAB_LABELS: Record<ReportTabId, string> = {
  overview: "Visão geral",
  commercial: "Comercial",
  team: "Equipe",
  units: "Unidades",
  financial: "Financeiro",
};

interface ReportTabsProps {
  readonly tabs: readonly ReportTabId[];
  readonly active: ReportTabId;
  readonly period: number;
}

export function ReportTabs({ tabs, active, period }: ReportTabsProps) {
  return (
    <PageTabs
      active={active}
      hrefBuilder={(tab) => `/dashboard?period=${period}&tab=${tab}`}
      tabs={tabs.map((tab) => ({ id: tab, label: TAB_LABELS[tab] }))}
    />
  );
}
