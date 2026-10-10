import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/core/cn";

export interface DsTrendStatCardProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  label: React.ReactNode;
  value: React.ReactNode;
  /** e.g. "12.5%" — the sign is implied by `trendDirection`, not the string. */
  trendValue?: string;
  trendDirection?: "up" | "down";
  caption?: React.ReactNode;
  /** Button row under the value (e.g. Transfer/Request-style primary actions). */
  actions?: React.ReactNode;
  /** Small chart/sparkline slot at the bottom of the card. */
  chart?: React.ReactNode;
}

/**
 * Trend Stat Card — extends docs/design-system.md § Stat / KPI Tile with a
 * corner trend pill, adapted from a Shadcn finance-dashboard reference the
 * user shared. Built on DsDashboardCard; the trend pill reuses the existing
 * Status Badge success/destructive tone pairs rather than new colors.
 */
export const DsTrendStatCard = React.forwardRef<HTMLDivElement, DsTrendStatCardProps>(
  function DsTrendStatCard(
    { className, label, value, trendValue, trendDirection, caption, actions, chart, children, ...props },
    ref,
  ) {
    return (
      <div
        ref={ref}
        data-slot="ds-trend-stat-card"
        className={cn(
          "flex flex-col rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-ds-16 font-ds-inter transition-colors duration-150 ease-out hover:border-ds-smoke",
          className,
        )}
        {...props}
      >
        <div className="flex items-center justify-between gap-ds-8">
          <p className="text-ds-body text-ds-steel">{label}</p>
          {trendValue ? (
            <span
              className={cn(
                "inline-flex items-center gap-ds-4 rounded-ds-tags px-ds-8 py-ds-4 text-ds-caption font-medium leading-none",
                trendDirection === "down"
                  ? "bg-ds-rose-wash text-ds-rose-ink"
                  : "bg-ds-soft-mint text-ds-forest-ink",
              )}
            >
              {trendDirection === "down" ? (
                <ArrowDownRight size={12} aria-hidden="true" />
              ) : (
                <ArrowUpRight size={12} aria-hidden="true" />
              )}
              {trendValue}
            </span>
          ) : null}
        </div>

        <p className="mt-ds-12 font-ds-mono text-ds-heading font-semibold tabular-nums text-ds-charcoal">
          {value}
        </p>
        {caption ? <p className="mt-ds-4 text-ds-caption text-ds-fog">{caption}</p> : null}

        {actions ? <div className="mt-ds-16 flex items-center gap-ds-8">{actions}</div> : null}
        {chart ? <div className="mt-ds-16">{chart}</div> : null}
        {children}
      </div>
    );
  },
);
