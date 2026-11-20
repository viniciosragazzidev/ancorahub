import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Barra segmentada (skill `interface-enxuta`): progresso em passos discretos, como a etapa do funil.
 * Uma cor só (Electric Blue) sobre Ash, segmentos de 4px com raio de pílula. O rótulo acessível vai em `label`.
 */
export interface SegmentBarProps {
  value: number;
  total: number;
  label: string;
  className?: string;
}

export function SegmentBar({ value, total, label, className }: SegmentBarProps) {
  const filled = Math.max(0, Math.min(total, Math.round(value)));
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="segment-bar"
      className={cn("flex min-w-0 flex-1 gap-ds-4", className)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn("h-1 flex-1 rounded-ds-tags", index < filled ? "bg-ds-electric-blue" : "bg-ds-ash")}
        />
      ))}
    </div>
  );
}
