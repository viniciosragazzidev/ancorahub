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
        "w-full rounded-ds-inputs border border-ds-midnight-ink bg-ds-canvas-white px-ds-12 py-ds-8 font-ds-inter text-ds-body-lg text-ds-charcoal outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-ds-fog focus-visible:border-ds-electric-blue focus-visible:ring-2 focus-visible:ring-ds-electric-blue/20 disabled:cursor-not-allowed disabled:border-ds-ash disabled:bg-ds-paper-mist disabled:text-ds-fog",
        className,
      )}
      {...props}
    />
  );
});
