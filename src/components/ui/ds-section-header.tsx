import * as React from "react";
import { cn } from "@/utils/core/cn";

export interface DsSectionHeaderProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions. Keep to ONE primary action; the rest belong in a `•••` menu. */
  actions?: React.ReactNode;
  /** Heading level. Page title is the h1 of DsPageHeader, so sections default to h2. */
  as?: "h2" | "h3";
}

/**
 * Section Header — one title + one line of description + actions, the same
 * everywhere a page is split into sections. It replaces the ad-hoc
 * `text-base font-semibold` / `CardTitle` / `text-xs` headings that made each
 * panel of a screen look different.
 *
 * Title: body-lg (16px) Inter 600 Charcoal. Description: body (14px) Fog.
 */
export function DsSectionHeader({ title, description, actions, as: Heading = "h2", className, ...props }: DsSectionHeaderProps) {
  return (
    <div
      data-slot="ds-section-header"
      className={cn("flex flex-wrap items-start justify-between gap-ds-12", className)}
      {...props}
    >
      <div className="min-w-0">
        <Heading className="text-[22px] font-medium tracking-[var(--tracking-display)] text-foreground">{title}</Heading>
        {description ? <p className="mt-ds-4 text-sm text-[var(--text-secondary)] dark:text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-ds-8">{actions}</div> : null}
    </div>
  );
}
