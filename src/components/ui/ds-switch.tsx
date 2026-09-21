"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/utils/core/cn";

/**
 * Switch / Toggle — docs/design-system.md § Switch / Toggle.
 * Track 36×20px, 9999px radius. Off: Ash. On: Electric Blue. Thumb: white 16px
 * circle with --shadow-subtle. Disabled: 50% opacity.
 */
export function DsSwitch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="ds-switch"
      className={cn(
        "inline-flex h-ds-20 w-ds-36 shrink-0 cursor-pointer items-center rounded-ds-tags p-0.5 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-ds-electric-blue data-unchecked:bg-ds-ash",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="pointer-events-none block size-4 rounded-full bg-ds-canvas-white shadow-ds-subtle transition-transform duration-150 data-checked:translate-x-4 data-unchecked:translate-x-0 motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  );
}
