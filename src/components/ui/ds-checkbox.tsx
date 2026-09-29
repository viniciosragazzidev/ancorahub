"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/utils/core/cn";

/**
 * Checkbox — docs/design-system.md § Checkbox.
 * Box 16px, 6px radius. Unchecked: white with a 1px Pebble border (Pebble's
 * documented role is "control outlines"). Checked: Electric Blue background and
 * border, white check. Disabled: Paper Mist background, Ash border. The hit area
 * is enlarged beyond the 16px box for touch and for dense table rows.
 */
export function DsCheckbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="ds-checkbox"
      className={cn(
        "relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-ds-inputs border border-ds-pebble bg-ds-canvas-white text-ds-canvas-white outline-none transition-colors duration-150 after:absolute after:-inset-2 focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 disabled:cursor-not-allowed disabled:border-ds-ash disabled:bg-ds-paper-mist data-checked:border-ds-electric-blue data-checked:bg-ds-electric-blue data-indeterminate:border-ds-electric-blue data-indeterminate:bg-ds-electric-blue",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center [&>svg]:size-3">
        <Check aria-hidden="true" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
