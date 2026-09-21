"use client";

import * as React from "react";
import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

// The four categorical accents docs/design-system.md already sanctions for
// telling multiple categories apart (the same set used by Pill Feature Tags:
// Electric Blue, Vivid Green, Tangerine, Lavender) — reused here instead of
// inventing a chart-specific palette. Steel is the documented "muted body
// text" neutral, used as the overflow/"other" bucket color.
const CATEGORY_COLORS = [
  "var(--color-ds-electric-blue)",
  "var(--color-ds-vivid-green)",
  "var(--color-ds-tangerine)",
  "var(--color-ds-lavender)",
  "var(--color-ds-steel)",
];

export interface DsDonutChartSlice {
  key: string;
  label: string;
  value: number;
}

export interface DsDonutChartProps {
  data: DsDonutChartSlice[];
  /** Big number shown centered inside the ring, e.g. a total. */
  centerValue?: React.ReactNode;
  centerLabel?: React.ReactNode;
  size?: number;
  className?: string;
}

/**
 * Donut chart — not in docs/design-system.md as its own entry; extends the
 * Chart (simple bar chart) spec's approach (reuse the existing Recharts +
 * ChartContainer engine, Ds tokens for color/radius/tooltip) to a second
 * chart shape, adapted from a Shadcn finance-dashboard reference.
 */
export function DsDonutChart({ data, centerValue, centerLabel, size = 180, className }: DsDonutChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  const config = React.useMemo<ChartConfig>(() => {
    const entries: ChartConfig = {};
    data.forEach((slice, index) => {
      entries[slice.key] = { label: slice.label, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] };
    });
    return entries;
  }, [data]);

  return (
    <div className={className}>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <ChartContainer config={config} className="aspect-square" style={{ width: size, height: size }}>
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent className="rounded-ds-buttons border-ds-ash shadow-ds-md" hideLabel />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={size * 0.32}
              outerRadius={size * 0.48}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((slice, index) => (
                <Cell key={slice.key} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        {centerValue !== undefined ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-ds-mono text-ds-heading-sm font-semibold tabular-nums text-ds-charcoal">
              {centerValue}
            </p>
            {centerLabel ? <p className="text-ds-caption text-ds-fog">{centerLabel}</p> : null}
          </div>
        ) : null}
      </div>

      <ul className="mt-ds-16 grid grid-cols-2 gap-ds-12">
        {data.map((slice, index) => (
          <li key={slice.key} className="flex items-center gap-ds-8">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-ds-inter text-ds-caption text-ds-charcoal">
              {slice.label}
            </span>
            <span className="shrink-0 font-ds-inter text-ds-caption font-medium text-ds-fog">
              {total > 0 ? Math.round((slice.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
