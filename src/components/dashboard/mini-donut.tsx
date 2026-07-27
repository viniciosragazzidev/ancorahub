"use client";

import { cn } from "@/lib/utils";

type MiniDonutProps = {
  segments: Array<{ name: string; value: number; color: string }>;
  total?: string | number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showCenterText?: boolean;
  className?: string;
};

export function MiniDonut({
  segments,
  total,
  size = "md",
  showCenterText = false,
  className,
}: MiniDonutProps) {
  // Filter out zero-value segments
  const activeSegments = segments.filter((s) => s.value > 0);

  const sum = activeSegments.reduce((acc, s) => acc + s.value, 0);
  const data =
    activeSegments.length > 0
      ? activeSegments
      : [{ name: "empty", value: 1, color: "var(--muted)" }];

  const dimensionMap = {
    sm: { box: "size-11", radius: 18, stroke: 4, centerText: "text-[11px] font-bold" },
    md: { box: "size-14", radius: 22, stroke: 5, centerText: "text-xs font-bold" },
    lg: { box: "size-16", radius: 26, stroke: 5, centerText: "text-sm font-bold" },
  };

  const currentSize = dimensionMap[size];
  const radius = currentSize.radius;
  const stroke = currentSize.stroke;
  const viewBoxSize = (radius + stroke) * 2;
  const center = viewBoxSize / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div
      className={cn("relative flex shrink-0 items-center justify-center", currentSize.box, className)}
    >
      <svg
        className={`${currentSize.box} -rotate-90`}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      >
        {/* Background track circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="var(--muted)"
          strokeWidth={stroke}
          className="opacity-30"
        />

        {/* Data segments */}
        {data.map((segment, index) => {
          const totalValue = activeSegments.length > 0 ? sum : 1;
          const percentage = (segment.value / totalValue) * 100;
          const strokeDashoffset = circumference - (percentage / 100) * circumference;
          const strokeDasharray = `${circumference} ${circumference}`;

          const rotation = (accumulatedPercent / 100) * 360;
          accumulatedPercent += percentage;

          return (
            <circle
              key={segment.name || index}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              transform={`rotate(${rotation} ${center} ${center})`}
              className="transition-all duration-300 ease-out"
            />
          );
        })}
      </svg>
      {showCenterText && total !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
          <span className={cn("font-mono tracking-tight text-foreground", currentSize.centerText)}>
            {total}
          </span>
        </div>
      )}
    </div>
  );
}
