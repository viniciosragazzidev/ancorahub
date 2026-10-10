import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsDashboardCardProps = React.ComponentPropsWithoutRef<"div">;

/**
 * Dashboard Card — docs/design-system.md § Components.
 * White background, 1px #e5e5e5 border, 12px radius, 8px internal padding.
 * Flat and border-defined — no shadow. The most frequent surface in the
 * system; relies on borders and spacing, not elevation.
 */
export const DsDashboardCard = React.forwardRef<
  HTMLDivElement,
  DsDashboardCardProps
>(function DsDashboardCard({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="ds-dashboard-card"
      className={cn(
        "rounded-ds-cards border border-ds-ash bg-ds-canvas-white p-ds-8 font-ds-inter text-ds-body text-ds-charcoal shadow-none transition-colors duration-150 ease-out hover:border-ds-smoke",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
