"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NextBestAction } from "../types";
import { trackNBAClicked } from "../analytics";

type NextBestActionInlineProps = {
  action: NextBestAction | null;
  className?: string;
};

export function NextBestActionInline({
  action,
  className = "",
}: NextBestActionInlineProps) {
  if (!action) return null;

  const content = (
    <Button
      type="button"
      size="sm"
      variant={action.priority === "critical" ? "destructive" : "outline"}
      onClick={() => trackNBAClicked(action)}
      className={`h-7 px-2.5 text-[11px] gap-1 rounded-lg font-medium transition-all ${
        action.priority === "critical"
          ? "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
          : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/15"
      } ${className}`}
      render={action.href ? <Link href={action.href} /> : undefined}
    >
      <Sparkles className="size-3 shrink-0" />
      <span className="truncate max-w-[130px]">{action.label}</span>
      <ArrowRight className="size-3 shrink-0" />
    </Button>
  );

  if (!action.reason) return content;

  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-semibold text-foreground mb-0.5">{action.title}</p>
          <p className="text-muted-foreground leading-relaxed">{action.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
