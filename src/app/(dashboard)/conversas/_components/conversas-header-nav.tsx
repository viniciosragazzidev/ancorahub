"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDirectorLitePage } from "@/components/arc/use-director-lite-page";
import { Sparkles } from "lucide-react";
import { BulkQualificationDialog } from "@/features/ai-qualification/components/bulk-qualification-dialog";

export function ConversationsBulkQualificationAction() {
  const directorSkinEnabled = useDirectorLitePage();
  if (!directorSkinEnabled) return <BulkQualificationDialog />;

  return (
    <BulkQualificationDialog
      trigger={(
        <Button
          aria-label="Abrir qualificação em massa"
          title="Qualificação em massa"
          size="sm"
          variant="outline"
          className="gap-2 px-3 max-[559px]:size-11 max-[559px]:gap-0 max-[559px]:px-0"
        >
          <Sparkles aria-hidden="true" className="size-4" />
          <span className="max-[559px]:sr-only">Qualificação em massa</span>
        </Button>
      )}
    />
  );
}

interface ConversasHeaderNavProps {
  currentTab: "leads" | "distribuidos" | "corretores" | "coex";
  /** Conversations in the list tab that is open (Leads or WhatsApp coex). */
  leadsCount?: number;
  distributedCount?: number;
  /** "WhatsApp coex · 7276" when a number is connected in coexistence; no tab otherwise. */
  coexLabel?: string | null;
}

export function ConversasHeaderNav({
  currentTab,
  leadsCount,
  distributedCount,
  coexLabel,
}: ConversasHeaderNavProps) {
  const directorSkinEnabled = useDirectorLitePage();
  const isLeadsActive = currentTab === "leads";
  const isDistributedActive = currentTab === "distribuidos";
  const isBrokersActive = currentTab === "corretores";
  const isCoexActive = currentTab === "coex";

  return (
    <div data-conversations-nav={directorSkinEnabled ? "true" : undefined} className="flex items-center rounded-[var(--radius-card)] border border-border/80 bg-muted/50 p-1 backdrop-blur-sm shadow-none">
      <Link
        href="/conversas"
        aria-current={directorSkinEnabled && isLeadsActive ? "page" : undefined}
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
        href="/conversas?tab=distribuidos"
        aria-current={directorSkinEnabled && isDistributedActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-medium transition-colors",
          isDistributedActive
            ? "bg-background text-foreground shadow-none font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        <span>Distribuídos</span>
        {isDistributedActive && typeof distributedCount === "number" && (
          <Badge variant="outline" className="ml-0.5 text-[10px] px-1.5 py-0">
            {distributedCount}
          </Badge>
        )}
      </Link>

      <Link
        href="/conversas?tab=corretores"
        aria-label={directorSkinEnabled ? "Número oficial com conversas de corretores" : undefined}
        aria-current={directorSkinEnabled && isBrokersActive ? "page" : undefined}
        className={cn(
          "flex items-center gap-1.5 rounded-[var(--radius-card)] px-3 py-1.5 text-xs font-medium transition-colors",
          isBrokersActive
            ? "bg-background text-foreground shadow-none font-semibold"
            : "text-muted-foreground hover:text-foreground hover:bg-background/40",
        )}
      >
        <span>{"Número oficial"}{directorSkinEnabled ? null : <> <span className="hidden lg:inline">· corretores</span></>}</span>
      </Link>

      {coexLabel ? (
        <Link
          href="/conversas?tab=coex"
          aria-current={directorSkinEnabled && isCoexActive ? "page" : undefined}
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
