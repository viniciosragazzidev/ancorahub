"use client";

import * as React from "react";
import Link from "next/link";
import {
  FolderOpen,
  SearchX,
  FilterX,
  ShieldAlert,
  Sparkles,
  Plus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateType =
  | "EMPTY_DATA"
  | "EMPTY_SEARCH"
  | "EMPTY_FILTER"
  | "NO_PERMISSION"
  | "OPTIONAL_FEATURE";

export interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  children?: React.ReactNode;
  className?: string;
  variant?: "card" | "plain" | "dashed";
}

const defaultTypeIcons: Record<EmptyStateType, LucideIcon> = {
  EMPTY_DATA: FolderOpen,
  EMPTY_SEARCH: SearchX,
  EMPTY_FILTER: FilterX,
  NO_PERMISSION: ShieldAlert,
  OPTIONAL_FEATURE: Sparkles,
};

export function EmptyState({
  type = "EMPTY_DATA",
  icon,
  title,
  description,
  action,
  secondaryAction,
  children,
  className,
  variant = "dashed",
}: EmptyStateProps) {
  const Icon = icon || defaultTypeIcons[type];
  const ActionIcon = action?.icon || (action?.href?.startsWith("http") ? ArrowRight : Plus);

  return (
    <div
      data-slot="canonical-empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 space-y-4",
        variant === "dashed" && "rounded-xl border border-dashed border-border/80 bg-muted/10",
        variant === "card" && "rounded-xl border border-border/70 bg-card shadow-xs",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted/80 text-muted-foreground border border-border/60">
        <Icon className="size-6 shrink-0 text-foreground/80" />
      </div>

      <div className="max-w-md space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction || children) && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {action && (
            action.href ? (
              <Button size="sm" className="gap-1.5 font-semibold text-xs shadow-xs" asChild>
                <Link href={action.href}>
                  <ActionIcon className="size-3.5" />
                  <span>{action.label}</span>
                </Link>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick} className="gap-1.5 font-semibold text-xs shadow-xs">
                <ActionIcon className="size-3.5" />
                <span>{action.label}</span>
              </Button>
            )
          )}

          {secondaryAction && (
            secondaryAction.href ? (
              <Button variant="outline" size="sm" className="text-xs font-medium" asChild>
                <Link href={secondaryAction.href}>
                  <span>{secondaryAction.label}</span>
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={secondaryAction.onClick} className="text-xs font-medium">
                <span>{secondaryAction.label}</span>
              </Button>
            )
          )}

          {children}
        </div>
      )}
    </div>
  );
}
