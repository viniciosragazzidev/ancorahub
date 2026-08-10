"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NextBestAction } from "../types";
import { RelatedActionsMenu } from "./related-actions-menu";
import { trackNBADisplayed, trackNBAClicked } from "../analytics";

type NextBestActionCardProps = {
  action: NextBestAction | null;
  compact?: boolean;
  className?: string;
};

const PRIORITY_BADGES: Record<
  string,
  { label: string; variant: "destructive" | "default" | "secondary" | "outline"; className: string }
> = {
  critical: { label: "Urgente", variant: "destructive", className: "bg-destructive/15 text-destructive border-destructive/30" },
  high: { label: "Recomendado", variant: "default", className: "bg-primary/15 text-primary border-primary/30" },
  normal: { label: "Próximo Passo", variant: "secondary", className: "bg-muted text-muted-foreground border-border" },
  low: { label: "Opcional", variant: "outline", className: "text-muted-foreground" },
};

export function NextBestActionCard({
  action,
  compact = false,
  className = "",
}: NextBestActionCardProps) {
  useEffect(() => {
    if (action) {
      trackNBADisplayed(action);
    }
  }, [action]);

  if (!action) return null;

  const priorityConfig = PRIORITY_BADGES[action.priority] ?? PRIORITY_BADGES.normal;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-background to-card p-4 sm:p-5 shadow-sm transition-all hover:border-primary/40 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={priorityConfig.variant}
              className={`text-[10px] uppercase font-bold tracking-wider gap-1 ${priorityConfig.className}`}
            >
              {action.priority === "critical" ? (
                <AlertTriangle className="size-3 shrink-0 animate-pulse" />
              ) : (
                <Sparkles className="size-3 shrink-0" />
              )}
              {priorityConfig.label}
            </Badge>

            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Próxima Ação
            </span>

            {action.reason && (
              <TooltipProvider delay={150}>
                <Tooltip>
                  <TooltipTrigger>
                    <span className="inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors">
                      <Info className="size-3.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    <p className="font-semibold text-foreground mb-0.5">Por que estou vendo isso?</p>
                    <p className="text-muted-foreground leading-relaxed">{action.reason}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          <h4 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
            {action.title}
          </h4>

          {action.description && !compact && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {action.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
          {action.secondaryActions && action.secondaryActions.length > 0 && (
            <RelatedActionsMenu secondaryActions={action.secondaryActions} />
          )}

          {action.href ? (
            <Button
              render={<Link href={action.href} />}
              size="sm"
              onClick={() => trackNBAClicked(action)}
              className="h-9 gap-1.5 px-4 font-semibold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
            >
              <span>{action.label}</span>
              <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => trackNBAClicked(action)}
              className="h-9 gap-1.5 px-4 font-semibold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
            >
              <span>{action.label}</span>
              <CheckCircle2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
