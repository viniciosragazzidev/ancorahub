import * as React from "react";
import { cn } from "@/utils/core/cn";

export interface DsEmptyStateProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Set false when already nested inside a bordered card, to avoid a double border. */
  bordered?: boolean;
}

/**
 * Empty State — docs/design-system.md § Empty State.
 * Icon square (Paper Mist, Silver icon) + title + description. Gets a
 * dashed Ash border only when NOT already nested inside another card.
 */
export const DsEmptyState = React.forwardRef<HTMLDivElement, DsEmptyStateProps>(
  function DsEmptyState(
    { className, icon, title, description, action, bordered = true, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="ds-empty-state"
        className={cn(
          "flex flex-col items-center gap-ds-8 rounded-ds-cards px-ds-24 py-ds-48 text-center",
          bordered && "border border-dashed border-[var(--border-subtle)] dark:border-border",
          className,
        )}
        {...props}
      >
        {icon ? (
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-border bg-muted text-[var(--text-secondary)] dark:text-muted-foreground motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200 motion-reduce:animate-none"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <p className="text-base font-medium text-foreground">{title}</p>
        {description ? (
          <p className="max-w-[18rem] text-sm text-[var(--text-secondary)] dark:text-muted-foreground">{description}</p>
        ) : null}
        {action ? <div className="mt-ds-8">{action}</div> : null}
      </div>
    );
  },
);
