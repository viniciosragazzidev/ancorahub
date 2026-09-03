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
    <nav aria-label="Abas de relatórios" className="flex flex-wrap items-center gap-1.5">
      {tabs.map((tab) => {
        const isCurrent = active === tab;

        return (
          <Link
            key={tab}
            href={`/relatorios?period=${period}&tab=${tab}`}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
            aria-current={isCurrent ? "page" : undefined}
          >
            <span>{TAB_LABELS[tab]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
