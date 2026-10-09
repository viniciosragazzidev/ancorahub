import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsDashboardCardProps = React.ComponentPropsWithoutRef<"div">;

/**
 * Dashboard Card — docs/design-system.md § Components.
 * White background, no border, 24px radius, one soft resting shadow (Lite
 * visual, docs/design-system/lite). The most frequent surface in the system.
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
        "rounded-ds-cards border border-transparent bg-ds-canvas-white p-ds-8 font-ds-inter text-ds-body text-ds-charcoal shadow-[var(--shadow-card)] transition-shadow duration-150 ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
