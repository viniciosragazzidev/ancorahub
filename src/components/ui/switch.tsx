"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-[42px] shrink-0 cursor-pointer items-center rounded-full border-0 p-[3px] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_oklab,var(--foreground)_72%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 data-checked:bg-[#3b2dff] data-unchecked:bg-[oklch(89.5%_0_0)] hover:data-unchecked:bg-[oklch(86%_0_0)] dark:data-unchecked:bg-[oklch(33%_0_0)] motion-reduce:transition-none",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[18px] rounded-full bg-white shadow-[0_0_0_.5px_oklch(0%_0_0/.07),0_1px_2px_oklch(0%_0_0/.14),0_2px_6px_oklch(0%_0_0/.06)] ring-0 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] data-checked:translate-x-[18px] data-unchecked:translate-x-0 motion-reduce:transition-none"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
