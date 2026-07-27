"use client";

import { motion } from "motion/react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { cardItemVariants } from "@/shared/animations";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Types ─── */

export type EmptyStateVariant = "default" | "card" | "ghost" | "inline";

export interface EmptyStateProps {
  /** Icon component to render above the title. */
  icon?: ComponentType<{ className?: string }>;
  /** Short heading text. */
  title: string;
  /** Optional longer explanation. */
  description?: string;
  /** Optional action element (button, link, etc.). */
  action?: ReactNode;
  /** Visual variant. */
  variant?: EmptyStateVariant;
  /** Additional class names for the container. */
  className?: string;
  /** Ativa animação de entrada fade-in + slide-up (cardItemVariants) */
  animated?: boolean;
  /** Atraso da animação em segundos (ex: 0.08 para efeito cascata) */
  animationDelay?: number;
  /** Exibe placeholders skeleton no lugar do conteúdo. */
  loading?: boolean;
}

/* ─── Variant styles ─── */

const variantStyles: Record<EmptyStateVariant, string> = {
  default: "rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-10",
  card: "rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-14",
  ghost: "",
  inline: "flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs text-muted-foreground bg-muted/50",
};

/* ─── Loading skeleton ─── */

function EmptyStateSkeleton({ variant }: { variant: EmptyStateVariant }) {
  if (variant === "inline") {
    return (
      <p className={cn(variantStyles.inline)}>
        <Skeleton className="size-3.5 shrink-0 rounded" />
        <Skeleton className="h-3 w-32" />
      </p>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variantStyles[variant],
      )}
    >
      <Skeleton
        className={cn(
          "rounded-full",
          variant === "ghost" ? "size-10" : "size-11",
        )}
      />
      <div className="mt-3 flex flex-col items-center gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  );
}

/* ─── Component ─── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
  animated,
  animationDelay = 0,
  loading,
}: EmptyStateProps) {
  if (loading) {
    return <EmptyStateSkeleton variant={variant} />;
  }

  const content = variant === "inline" ? (
    <p className={cn(variantStyles.inline, className)}>
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span>{title}</span>
    </p>
  ) : (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        variantStyles[variant],
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "grid place-items-center rounded-full bg-muted text-muted-foreground",
            variant === "ghost" ? "size-10" : "size-11",
          )}
        >
          <Icon className="size-5" />
        </span>
      )}
      <p className={cn("font-semibold", Icon ? "mt-3" : "")}>{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );

  if (!animated) return content;

  return (
    <motion.div
      variants={cardItemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: animationDelay }}
    >
      {content}
    </motion.div>
  );
}
