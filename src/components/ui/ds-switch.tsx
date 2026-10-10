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
        "inline-flex h-6 w-[42px] shrink-0 cursor-pointer items-center rounded-full p-[3px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-[#3b2dff] data-unchecked:bg-[oklch(89.5%_0_0)]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="ds-switch-thumb"
        className="pointer-events-none block size-[18px] rounded-full bg-white shadow-[0_0_0_.5px_oklch(0%_0_0/.07),0_1px_2px_oklch(0%_0_0/.14),0_2px_6px_oklch(0%_0_0/.06)] transition-transform duration-150 data-checked:translate-x-[18px] data-unchecked:translate-x-0 motion-reduce:transition-none"
      />
    </SwitchPrimitive.Root>
  );
}
