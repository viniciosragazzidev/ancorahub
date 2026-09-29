"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export type FunnelDatum = {
  stage: string;
  volume: number;
  lost?: boolean;
};

type FunnelChartProps = {
  data: FunnelDatum[];
  className?: string;
};

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 156;
const CENTER_Y = 78;
const MAX_HALF_HEIGHT = 42;
const MIN_HALF_HEIGHT = 4;

function countLabel(value: number) {
  return value.toLocaleString("pt-BR");
}

function stageHalfHeight(value: number, maximum: number) {
  if (value <= 0) return 0;
  return Math.max(MIN_HALF_HEIGHT, (value / maximum) * MAX_HALF_HEIGHT);
}

function stagePath(index: number, total: number, value: number, nextValue: number, maximum: number) {
  const startX = (index / total) * VIEWBOX_WIDTH;
  const endX = ((index + 1) / total) * VIEWBOX_WIDTH;
  const startHalfHeight = stageHalfHeight(value, maximum);
  const endHalfHeight = stageHalfHeight(nextValue, maximum);
  return [
    `M ${startX} ${CENTER_Y - startHalfHeight}`,
    `L ${endX} ${CENTER_Y - endHalfHeight}`,
    `L ${endX} ${CENTER_Y + endHalfHeight}`,
    `L ${startX} ${CENTER_Y + startHalfHeight}`,
    "Z",
  ].join(" ");
}

export function FunnelChart({ data, className }: FunnelChartProps) {
  const gradientId = useId();
  const stages = data.filter((item) => !item.lost);
  const terminal = data.find((item) => item.lost);
  const maximum = Math.max(stages[0]?.volume ?? 0, 1);

  return (
    <div className={cn("space-y-4", className)} aria-label="Funil de leads">
      {stages.length ? (
        <svg
          aria-hidden="true"
          className="block h-auto w-full overflow-visible"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
          role="presentation"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.92" />
            </linearGradient>
          </defs>
          {stages.map((stage, index) => (
            <path
              key={stage.stage}
              d={stagePath(index, stages.length, stage.volume, stages[index + 1]?.volume ?? stage.volume, maximum)}
              fill={`url(#${gradientId})`}
              opacity={1 - index * 0.045}
              stroke="var(--card)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      ) : (
        <div className="flex h-28 items-center justify-center rounded-ds-medium bg-muted/40 text-sm text-muted-foreground">
          Sem dados de funil no período.
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4" role="list" aria-label="Etapas do funil">
        {data.map((stage, index) => {
          const share = maximum > 0 ? Math.round((stage.volume / maximum) * 100) : 0;
          return (
            <div key={stage.stage} className="min-w-0" role="listitem">
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", stage.lost ? "bg-muted-foreground/45" : "bg-primary")}
                />
                <span className="truncate text-xs text-muted-foreground">{stage.stage}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="font-ds-mono text-sm font-medium tabular-nums text-foreground">{countLabel(stage.volume)}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{index === 0 ? "base" : `${share}%`}</span>
              </div>
            </div>
          );
        })}
      </div>
      {terminal ? <p className="border-t border-border pt-3 text-xs text-muted-foreground">Perdidos: <span className="font-ds-mono font-medium tabular-nums text-foreground">{countLabel(terminal.volume)}</span></p> : null}
    </div>
  );
}
