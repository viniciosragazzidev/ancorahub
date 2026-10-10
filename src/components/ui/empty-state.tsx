"use client";

import React from "react";
import Link from "next/link";
import { FolderOpen, Plus, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel = "Como funciona?",
  secondaryActionHref = "/guia",
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/15 p-8 text-center space-y-4", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6 shrink-0" />
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-6">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {actionLabel && (
          actionHref ? (
            <Button size="sm" className="gap-1.5 font-semibold text-xs" render={<Link href={actionHref} />}>
              <Plus className="size-3.5" />
              {actionLabel}
            </Button>
          ) : (
            <Button size="sm" onClick={onAction} className="gap-1.5 font-semibold text-xs">
              <Plus className="size-3.5" />
              {actionLabel}
            </Button>
          )
        )}

        {secondaryActionLabel && secondaryActionHref && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" render={<Link href={secondaryActionHref} />}>
            <HelpCircle className="size-3.5 text-muted-foreground" />
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
