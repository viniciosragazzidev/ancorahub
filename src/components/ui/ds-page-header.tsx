import * as React from "react";
import { cn } from "@/utils/core/cn";

export interface DsPageHeaderProps
  extends Omit<React.ComponentPropsWithoutRef<"header">, "title"> {
  title: React.ReactNode;
  breadcrumb?: React.ReactNode;
  description?: React.ReactNode;
  /** Status/context badge next to the title (e.g. a DsStatusBadge). */
  context?: React.ReactNode;
  /** Slot before the title block — the shell's menu button on pages inside the app shell. */
  leading?: React.ReactNode;
  /**
   * Page actions — buttons, counters. Right-aligned on wide screens; on narrow
   * screens they drop to their own full-width row so they never squeeze the title.
   */
  actions?: React.ReactNode;
  /** Shell utilities (search, notifications). Stay top-right on every width. */
  toolbar?: React.ReactNode;
}

/**
 * Page Header — docs/design-system.md § Page Header.
 * Canvas White, 1px Ash bottom border, no shadow. The spec's base is a slim
 * 64px single-line bar; a description line makes the block grow past that
 * instead of clipping, so height is min-64px + content rather than a hard 64.
 *
 * Narrow screens: row 1 is [leading + title] and [toolbar]; `actions` wrap to
 * row 2; breadcrumb and description are hidden to keep the bar compact (the
 * page title alone identifies the screen). Wide screens: title on the left,
 * then actions, then toolbar.
 */
export const DsPageHeader = React.forwardRef<HTMLElement, DsPageHeaderProps>(
  function DsPageHeader(
    { className, title, breadcrumb, description, context, leading, actions, toolbar, ...props },
    ref,
  ) {
    return (
      <header
        ref={ref}
        data-slot="ds-page-header"
        className={cn(
          "flex min-h-ds-64 w-full flex-wrap items-center gap-x-ds-12 gap-y-ds-8 border-b border-ds-ash bg-ds-canvas-white px-ds-16 py-ds-12 sm:gap-x-ds-16 sm:px-ds-24 sm:py-ds-16",
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 flex-1 items-center gap-ds-12">
          {leading ? <div className="shrink-0">{leading}</div> : null}
          <div className="flex min-w-0 flex-col gap-ds-4">
            {breadcrumb ? (
              <p className="hidden truncate font-ds-inter text-ds-caption text-ds-fog sm:block">{breadcrumb}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-ds-8">
              <h1 className="font-ds-inter text-ds-body-xl font-semibold text-ds-charcoal sm:text-ds-heading-sm">
                {title}
              </h1>
              {context}
            </div>
            {description ? (
              <p className="hidden font-ds-inter text-ds-body text-ds-steel sm:block">{description}</p>
            ) : null}
          </div>
        </div>
        {toolbar ? (
          <div className="flex shrink-0 items-center gap-ds-8 sm:order-3">{toolbar}</div>
        ) : null}
        {actions ? (
          <div className="flex min-w-0 basis-full items-center gap-ds-8 overflow-x-auto [scrollbar-width:none] sm:order-2 sm:basis-auto sm:shrink-0 sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {actions}
          </div>
        ) : null}
      </header>
    );
  },
);
