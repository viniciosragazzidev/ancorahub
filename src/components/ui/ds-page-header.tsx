import * as React from "react";
import { cn } from "@/utils/core/cn";

export interface DsPageHeaderProps
  extends Omit<React.ComponentPropsWithoutRef<"header">, "title"> {
  title: React.ReactNode;
  breadcrumb?: React.ReactNode;
  description?: React.ReactNode;
  /** Status/context badge next to the title (e.g. a DsStatusBadge). */
  context?: React.ReactNode;
  /** Right-aligned slot — buttons, counters. */
  actions?: React.ReactNode;
}

/**
 * Page Header — docs/design-system.md § Page Header.
 * Canvas White, 1px Ash bottom border, no shadow. The spec's base is a slim
 * 64px single-line bar; a description line makes the block grow past that
 * instead of clipping, so height is min-64px + content rather than a hard 64.
 */
export const DsPageHeader = React.forwardRef<HTMLElement, DsPageHeaderProps>(
  function DsPageHeader(
    { className, title, breadcrumb, description, context, actions, ...props },
    ref,
  ) {
    return (
      <header
        ref={ref}
        data-slot="ds-page-header"
        className={cn(
          "flex min-h-ds-64 w-full flex-wrap items-center justify-between gap-ds-16 border-b border-ds-ash bg-ds-canvas-white px-ds-24 py-ds-16",
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 flex-col gap-ds-4">
          {breadcrumb ? (
            <p className="font-ds-inter text-ds-caption text-ds-fog">{breadcrumb}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-ds-8">
            <h1 className="font-ds-inter text-ds-heading-sm font-semibold text-ds-charcoal">
              {title}
            </h1>
            {context}
          </div>
          {description ? (
            <p className="font-ds-inter text-ds-body text-ds-steel">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-ds-8">{actions}</div>
        ) : null}
      </header>
    );
  },
);
