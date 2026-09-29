import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsPillBadgeProps = React.ComponentPropsWithoutRef<"span">;

/**
 * Pill Badge — docs/design-system.md § Components.
 * Transparent/white background, #0a0a0a text, 9999px radius, minimal
 * padding. Small notification dots, version labels, category markers.
 */
export const DsPillBadge = React.forwardRef<HTMLSpanElement, DsPillBadgeProps>(
  function DsPillBadge({ className, children, ...props }, ref) {
    return (
      <span
        ref={ref}
        data-slot="ds-pill-badge"
        className={cn(
          "inline-flex items-center rounded-ds-tags border-0 bg-transparent px-ds-8 py-ds-4 font-ds-inter text-ds-caption font-medium text-ds-midnight-ink",
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
