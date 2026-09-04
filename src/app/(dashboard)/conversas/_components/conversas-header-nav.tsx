"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConversasHeaderNavProps {
  currentTab: "leads" | "corretores";
  leadsCount?: number;
}

export function ConversasHeaderNav({
  currentTab,
  leadsCount,
}: ConversasHeaderNavProps) {
  const isLeadsActive = currentTab === "leads";
  const isBrokersActive = currentTab === "corretores";

  return (
    <div className="flex items-center rounded-lg border border-border/80 bg-muted/50 p-1 backdrop-blur-sm shadow-xs">
      <Link
        href="/conversas"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          isLeadsActive
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        <span>Leads</span>
        {typeof leadsCount === "number" && (
          <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0">
            {leadsCount}
          </Badge>
        )}
      </Link>

      <Link
        href="/conversas?tab=corretores"
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          isBrokersActive
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        <span>Número oficial <span className="hidden lg:inline">· corretores</span></span>
      </Link>
    </div>
  );
}
