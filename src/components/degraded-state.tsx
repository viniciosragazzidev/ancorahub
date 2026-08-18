"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RotateCcw, Warning } from "@/components/huge-icons";

interface DegradedStateProps {
  /** Icon component to render above the title. */
  icon?: ComponentType<{ className?: string }>;
  /** Short heading text. */
  title: string;
  /** Optional longer explanation. */
  description?: string;
  /** Retry callback. */
  onRetry?: () => void;
  /** Additional class names for the container. */
  className?: string;
  /** Show as a card with border, or inline. */
  variant?: "card" | "inline" | "banner";
}

/**
 * DegradedState — shown when an external dependency is unavailable but the
 * page itself is still usable. The user sees a clear message that a specific
 * feature is temporarily unavailable, with an optional retry button.
 *
 * Use this instead of returning `[]` when a service fails — it makes the
 * degradation visible to the user.
 */
export function DegradedState({
  icon: Icon = Warning,
  title,
  description,
  onRetry,
  className,
  variant = "card",
}: DegradedStateProps) {
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-3",
          className,
        )}
      >
        <Icon className="size-4 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{title}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="shrink-0 gap-1 text-xs"
          >
            <RotateCcw className="size-3" />
            Tentar
          </Button>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span>{title}</span>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="ml-auto shrink-0 gap-1 text-[10px]"
          >
            <RotateCcw className="size-2.5" />
            Tentar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-warning/30 bg-warning/[0.03] px-6 py-8 text-center",
        className,
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl border border-warning/20 bg-warning/10">
        <Icon className="size-5 text-warning" />
      </span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="mt-4 gap-1.5"
        >
          <RotateCcw className="size-3" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/**
 * InlineError — lightweight inline error display for secondary components.
 * Shows a compact error message with optional retry, without blocking the page.
 */
export function InlineError({
  message = "Ocorreu um erro ao carregar estes dados.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-xs text-destructive",
        className,
      )}
    >
      <Warning className="size-3.5 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onRetry}
          className="shrink-0 gap-1 text-[10px] text-destructive hover:text-destructive"
        >
          <RotateCcw className="size-2.5" />
          Tentar
        </Button>
      )}
    </div>
  );
}
