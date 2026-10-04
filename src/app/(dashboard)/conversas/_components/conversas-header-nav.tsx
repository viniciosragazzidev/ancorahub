"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConversasHeaderNavProps {
  currentTab: "leads" | "corretores" | "coex";
  /** Conversations in the list tab that is open (Leads or WhatsApp coex). */
  leadsCount?: number;
  /** "WhatsApp coex · 7276" when a number is connected in coexistence; no tab otherwise. */
  coexLabel?: string | null;
}

export function ConversasHeaderNav({
  currentTab,
  leadsCount,
  coexLabel,
}: ConversasHeaderNavProps) {
  const isLeadsActive = currentTab === "leads";
  const isBrokersActive = currentTab === "corretores";
  const isCoexActive = currentTab === "coex";

  return (
    <div className="flex items-center rounded-[var(--radius-card)] border border-border/80 bg-muted/50 p-1 backdrop-blur-sm shadow-none">
      <Link
        href="/conversas"
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-medium transition-colors",
          isLeadsActive
            ? "bg-background text-foreground shadow-none font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        <span>Leads</span>
        {isLeadsActive && typeof leadsCount === "number" && (
          <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0">
            {leadsCount}
          </Badge>
        )}
      </Link>

      <Link
        href="/conversas?tab=corretores"
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-medium transition-colors",
          isBrokersActive
            ? "bg-background text-foreground shadow-none font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        <span>Número oficial <span className="hidden lg:inline">· corretores</span></span>
      </Link>

      {coexLabel ? (
        <Link
          href="/conversas?tab=coex"
          className={cn(
            "flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-medium transition-colors",
            isCoexActive
              ? "bg-background text-foreground shadow-none font-semibold"
              : "text-muted-foreground hover:text-foreground hover:bg-background/40",
          )}
        >
          <span>{coexLabel.split(" · ")[0]} <span className="hidden lg:inline">· {coexLabel.split(" · ")[1]}</span></span>
          {isCoexActive && typeof leadsCount === "number" && (
            <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0">
              {leadsCount}
            </Badge>
          )}
        </Link>
      ) : null}
    </div>
  );
}
