"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LegacyChartGradient, legacyGradientFill } from "@/lib/chart-gradient";

type SparklineProps = {
  data: number[];
  color?: string;
  className?: string;
};

/**
 * Sparkline SVG leve e reutilizável para cards de indicadores.
 * Aceita cor dinâmica (ex.: "var(--chart-1)") e tem o mesmo
 * visual de linha com gradiente usado nos demais cards.
 */
export function Sparkline({ data, color = "var(--chart-1)", className }: SparklineProps) {
  const directorLite = useArcScopeEnabled();
  const gradientId = useId().replace(/:/g, "");
  const values = data.length ? data : [0];
  const max = Math.max(...values, 1);

  const points = values.map((value, index) => {
    const x = values.length === 1 ? 50 : (index / (values.length - 1)) * 100;
    const y = 30 - (value / max) * 22;
    return { x, y };
  });

  const line = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  return (
    <div className={cn("h-9 w-full overflow-visible", className)} aria-hidden="true">
      <svg viewBox="0 0 100 36" className="h-9 w-full overflow-visible" preserveAspectRatio="none">
        {!directorLite ? <LegacyChartGradient id={gradientId} color={color} vertical fromOpacity={0.28} toOpacity={0} /> : null}
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={`${line} L 100 34 L 0 34 Z`} fill={directorLite ? color : legacyGradientFill(gradientId)} opacity={directorLite ? 0.14 : 1} />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="1.8" fill={color} />
        ))}
      </svg>
    </div>
  );
}
