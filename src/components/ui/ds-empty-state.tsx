import * as React from "react";
import { cn } from "@/utils/core/cn";
import ArcEmptyState from "@/components/arc/empty-state/empty-state";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";

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
    const directorLite = useArcScopeEnabled();
    if (directorLite && typeof title === "string" && (description === undefined || typeof description === "string")) {
      return (
        <ArcEmptyState
          ref={ref}
          title={title}
          description={description ?? ""}
          action={action}
          icon={icon}
          className={className}
        />
      );
    }
    return (
      <div
        ref={ref}
        data-slot="ds-empty-state"
        className={cn(
          "flex flex-col items-center gap-ds-8 rounded-ds-cards px-ds-24 py-ds-48 text-center",
          bordered && "border border-dashed border-ds-ash",
          className,
        )}
        {...props}
      >
        {icon ? (
          <span
            className="flex size-ds-40 shrink-0 items-center justify-center rounded-ds-cards bg-ds-paper-mist text-ds-silver"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <p className="font-ds-inter text-ds-body-lg font-semibold text-ds-charcoal">{title}</p>
        {description ? (
          <p className="max-w-[40ch] font-ds-inter text-ds-body text-ds-fog">{description}</p>
        ) : null}
        {action ? <div className="mt-ds-8">{action}</div> : null}
      </div>
    );
  },
);
