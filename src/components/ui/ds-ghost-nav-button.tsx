import * as React from "react";
import { cn } from "@/utils/core/cn";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";

export interface DsGhostNavButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {}

/**
 * Ghost Nav Button — docs/design-system.md § Components.
 * Transparent background, no visible border until hover. Top-level nav
 * items (Product, Solutions, Resources, Enterprise).
 */
export const DsGhostNavButton = React.forwardRef<
  HTMLButtonElement,
  DsGhostNavButtonProps
>(function DsGhostNavButton({ className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      data-slot="ds-ghost-nav-button"
      className={cn(dsButtonVariants({ dsVariant: "ghost-nav" }), className)}
      {...props}
    >
      {children}
    </button>
  );
});
