"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NextBestAction } from "../types";
import { trackNBAClicked } from "../analytics";

type NextBestActionBannerProps = {
  action: NextBestAction | null;
  className?: string;
};

export function NextBestActionBanner({
  action,
  className = "",
}: NextBestActionBannerProps) {
  if (!action || action.priority !== "critical") return null;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="size-4 shrink-0 animate-pulse text-destructive" />
        <span className="font-semibold truncate">{action.title}:</span>
        <span className="truncate text-destructive/90 hidden sm:inline">
          {action.description || action.reason}
        </span>
      </div>

      <Button
        size="sm"
        variant="destructive"
        onClick={() => trackNBAClicked(action)}
        render={action.href ? <Link href={action.href} /> : undefined}
        className="h-7 gap-1 px-3 text-xs font-semibold shrink-0"
      >
        <span>{action.label}</span>
        <ArrowRight className="size-3" />
      </Button>
    </div>
  );
}
