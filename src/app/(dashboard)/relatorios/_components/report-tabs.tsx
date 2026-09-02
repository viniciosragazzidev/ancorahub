"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
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
    <nav aria-label="Abas de relatórios" className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <Link
          key={tab}
          href={`/relatorios?period=${period}&tab=${tab}`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tab === active
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          aria-current={tab === active ? "page" : undefined}
        >
          {TAB_LABELS[tab]}
        </Link>
      ))}
    </nav>
  );
}
