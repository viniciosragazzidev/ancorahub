import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsStatTileTone = "default" | "success" | "warning" | "destructive";

export interface DsStatTileProps extends React.ComponentPropsWithoutRef<"div"> {
  label: React.ReactNode;
  /** Either a numeric/short value, or `hint` for a text-only tile — never both. */
  value?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  /**
   * Electric Blue by default. A semantic tone is reserved for when the
   * number itself represents a real status (e.g. an overdue count) — never
   * applied just for visual variety across a grid of tiles.
   */
  tone?: DsStatTileTone;
}

const TONE_TEXT: Record<DsStatTileTone, string> = {
  default: "text-ds-charcoal",
  success: "text-ds-forest-ink",
  warning: "text-ds-amber-ink",
  destructive: "text-ds-rose-ink",
};

const TONE_CHIP: Record<DsStatTileTone, string> = {
  default: "bg-ds-powder-blue text-ds-electric-blue",
  success: "bg-ds-soft-mint text-ds-forest-ink",
  warning: "bg-ds-amber-wash text-ds-amber-ink",
  destructive: "bg-ds-rose-wash text-ds-rose-ink",
};

/**
 * Stat / KPI Tile — docs/design-system.md § Stat / KPI Tile.
 * Meant to sit inside a DsDashboardCard (this component is content-only, no
 * border of its own). Number in Geist Mono 24px — the doc already reserves
 * that face/size for "large code display elements".
 */
export const DsStatTile = React.forwardRef<HTMLDivElement, DsStatTileProps>(
  function DsStatTile({ className, label, value, hint, icon, tone = "default", ...props }, ref) {
    return (
      <div ref={ref} data-slot="ds-stat-tile" className={cn("flex flex-col gap-ds-4", className)} {...props}>
        <div className="flex items-center gap-ds-8">
          {icon ? (
            <span
              className={cn(
                "flex size-ds-28 shrink-0 items-center justify-center rounded-ds-buttons",
                TONE_CHIP[tone],
              )}
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
          <p className="font-ds-inter text-ds-caption text-ds-steel">{label}</p>
        </div>
        {value !== undefined ? (
          <p className={cn("font-ds-mono text-ds-heading-sm font-semibold tabular-nums", TONE_TEXT[tone])}>
            {value}
          </p>
        ) : (
          <p className="font-ds-inter text-ds-body-lg font-medium text-ds-charcoal">{hint}</p>
        )}
      </div>
    );
  },
);
