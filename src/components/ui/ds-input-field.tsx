import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsInputFieldProps = React.ComponentPropsWithoutRef<"input">;

/**
 * Input Field — docs/design-system.md § Components.
 *
 * White background, 1px #000000 border, 6px radius, 8px/12px padding.
 * The black border is a DELIBERATE, documented exception to the system's
 * default #e5e5e5 container border — do not normalize it to --color-ds-ash.
 */
export const DsInputField = React.forwardRef<
  HTMLInputElement,
  DsInputFieldProps
>(function DsInputField({ className, disabled, ...props }, ref) {
  return (
    <input
      ref={ref}
      data-slot="ds-input-field"
      disabled={disabled}
      className={cn(
        "h-11 w-full rounded-full border border-[var(--border-strong)] bg-card px-3 text-sm text-foreground outline-none transition-[border-color] duration-150 ease-out placeholder:text-muted-foreground hover:border-foreground focus-visible:border-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});
