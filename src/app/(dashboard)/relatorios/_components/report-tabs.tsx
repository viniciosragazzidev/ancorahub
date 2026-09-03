"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReportTabId } from "@/features/reports/metrics/metric-catalog";
import { CircleNotch } from "@phosphor-icons/react";

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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticTab, setOptimisticTab] = useState<ReportTabId>(active);

  // Sincronizar quando a aba do servidor atualizar
  useEffect(() => {
    setOptimisticTab(active);
  }, [active]);

  // Prefetch de todas as abas permitidas para o período atual
  useEffect(() => {
    tabs.forEach((tab) => {
      router.prefetch(`/relatorios?period=${period}&tab=${tab}`);
    });
  }, [tabs, period, router]);

  const handleTabClick = (tab: ReportTabId) => {
    if (tab === active) return;
    setOptimisticTab(tab);
    startTransition(() => {
      router.push(`/relatorios?period=${period}&tab=${tab}`, { scroll: false });
    });
  };

  return (
    <nav aria-label="Abas de relatórios" className="flex flex-wrap items-center gap-1.5">
      {tabs.map((tab) => {
        const isCurrent = optimisticTab === tab;
        const isLoadingThisTab = isPending && isCurrent && active !== tab;

        return (
          <button
            key={tab}
            type="button"
            onClick={() => handleTabClick(tab)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 active:scale-98",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
            )}
            aria-current={isCurrent ? "page" : undefined}
          >
            {isLoadingThisTab && (
              <CircleNotch className="size-3.5 animate-spin" />
            )}
            <span>{TAB_LABELS[tab]}</span>
          </button>
        );
      })}
    </nav>
  );
}
