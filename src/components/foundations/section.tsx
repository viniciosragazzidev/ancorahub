"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: "plain" | "card" | "bordered";
}

export function Section({
  title,
  description,
  actions,
  variant = "plain",
  children,
  className,
  ...props
}: SectionProps) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <section
      data-slot="canonical-section"
      className={cn(
        "space-y-4",
        variant === "card" && "rounded-2xl border border-border/60 bg-card/40 p-5 shadow-none",
        variant === "bordered" && "rounded-xl border border-border/70 p-4",
        className,
      )}
      {...props}
    >
      {hasHeader && (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">{actions}</div>}
        </div>
      )}

      <div>{children}</div>
    </section>
  );
}

export interface CollapsibleSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div
      data-slot="canonical-collapsible-section"
      className={cn("rounded-xl border border-border/70 bg-card/50 transition-all", className)}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground leading-normal">{description}</p>
          )}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t border-border/60 p-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
