"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PageTabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  disabled?: boolean;
}

export interface PageTabsProps {
  tabs: readonly PageTabItem[];
  active: string;
  onTabChange?: (tabId: string) => void;
  hrefBuilder?: (tabId: string) => string;
  className?: string;
}

export function PageTabs({
  tabs,
  active,
  onTabChange,
  hrefBuilder,
  className,
}: PageTabsProps) {
  return (
    <nav
      aria-label="Abas de navegação do contexto"
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]",
        className,
      )}
      data-slot="canonical-page-tabs"
    >
      {tabs.map((tab) => {
        const isCurrent = active === tab.id;
        const Icon = tab.icon;

        if (hrefBuilder && !tab.disabled) {
          return (
            <Link
              key={tab.id}
              href={hrefBuilder(tab.id)}
              scroll={false}
              aria-current={isCurrent ? "page" : undefined}
              className={cn(
                "group relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all select-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCurrent
                  ? "bg-primary text-primary-foreground shadow-xs cursor-default"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground cursor-pointer",
              )}
            >
              {Icon && <Icon className={cn("size-3.5 shrink-0", isCurrent ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <Badge
                  variant={isCurrent ? "secondary" : "outline"}
                  className={cn(
                    "px-1.5 py-0 text-[10px] font-bold",
                    isCurrent && "bg-primary-foreground/20 text-primary-foreground border-transparent",
                  )}
                >
                  {tab.badge}
                </Badge>
              )}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange?.(tab.id)}
            disabled={tab.disabled || isCurrent}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "group relative flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all select-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCurrent
                ? "bg-primary text-primary-foreground shadow-xs cursor-default"
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground cursor-pointer",
              tab.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
            )}
          >
            {Icon && <Icon className={cn("size-3.5 shrink-0", isCurrent ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <Badge
                variant={isCurrent ? "secondary" : "outline"}
                className={cn(
                  "px-1.5 py-0 text-[10px] font-bold",
                  isCurrent && "bg-primary-foreground/20 text-primary-foreground border-transparent",
                )}
              >
                {tab.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
}
