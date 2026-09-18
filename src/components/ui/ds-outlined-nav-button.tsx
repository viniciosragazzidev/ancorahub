import * as React from "react";
import { cn } from "@/utils/core/cn";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";

export interface DsOutlinedNavButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {}

/**
 * Outlined Nav Button — docs/design-system.md § Components.
 * White fill, 1px #e5e5e5 border. Secondary nav action (e.g. "Log in").
 */
export const DsOutlinedNavButton = React.forwardRef<
  HTMLButtonElement,
  DsOutlinedNavButtonProps
>(function DsOutlinedNavButton({ className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      data-slot="ds-outlined-nav-button"
      className={cn(dsButtonVariants({ dsVariant: "outlined-nav" }), className)}
      {...props}
    >
      {children}
    </button>
  );
});
