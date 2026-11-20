import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Dica de tecla (skill `interface-enxuta`): "↵", "Esc", "⌘K". Mono caption, borda Ash, raio de input (6px).
 * Só aparece onde a tecla funciona de verdade; nunca decorativa.
 */
export function Kbd({ className, children, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded-ds-inputs border border-current/25 px-1 font-ds-mono text-[10px] leading-none font-medium opacity-80",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
