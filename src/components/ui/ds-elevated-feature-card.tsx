import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsElevatedFeatureCardProps = React.ComponentPropsWithoutRef<"div">;

/**
 * Elevated Feature Card — docs/design-system.md § Components.
 * White background, 16px radius, 16px padding, subtle 4px ring shadow
 * (rgba(0,0,0,0.1) 0 0 0 4px). Used sparingly to lift hero product mockups
 * and featured content above the surrounding flat, border-only cards.
 */
export const DsElevatedFeatureCard = React.forwardRef<
  HTMLDivElement,
  DsElevatedFeatureCardProps
>(function DsElevatedFeatureCard({ className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="ds-elevated-feature-card"
      className={cn(
        "rounded-ds-large-cards border-0 bg-ds-canvas-white p-ds-16 font-ds-inter text-ds-body text-ds-charcoal shadow-ds-subtle-2",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
});
