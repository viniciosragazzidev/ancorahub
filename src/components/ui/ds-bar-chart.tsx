"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Electric Blue (#2563eb) at 35% — same hue, second tone. Never a second
// chromatic color: docs/design-system.md § Chart (simple bar chart), and the
// "one chromatic color per component" rule confirmed with the user.
const PRIMARY_COLOR = "var(--color-ds-electric-blue)";
const SECONDARY_COLOR = "rgba(37, 99, 235, 0.35)";

export interface DsBarChartSeries<T> {
  key: Extract<keyof T, string>;
  label: string;
}

export interface DsBarChartProps<T extends Record<string, unknown>> {
  data: T[];
  xKey: Extract<keyof T, string>;
  /** First series renders in full Electric Blue, a second in the same hue at 35%. */
  series: [DsBarChartSeries<T>] | [DsBarChartSeries<T>, DsBarChartSeries<T>];
  xTickFormatter?: (value: string) => string;
  height?: number;
  className?: string;
  /** Sparkline mode for KPI cards — no axes/grid/tooltip legend, thin bars. */
  compact?: boolean;
}

/**
 * Chart (simple bar chart) — docs/design-system.md § Chart (simple bar chart).
 * Wraps the project's existing Recharts + ChartContainer engine (already used
 * in lead-trend-chart.tsx) instead of building axes/tooltips from scratch.
 */
export function DsBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  xTickFormatter,
  height = 220,
  className,
  compact = false,
}: DsBarChartProps<T>) {
  const config = React.useMemo<ChartConfig>(() => {
    const entries: ChartConfig = {};
    series.forEach((s, index) => {
      entries[s.key] = {
        label: s.label,
        color: index === 0 ? PRIMARY_COLOR : SECONDARY_COLOR,
      };
    });
    return entries;
  }, [series]);

  return (
    <ChartContainer
      config={config}
      className={className ?? "aspect-auto w-full"}
      style={{ height }}
    >
      <BarChart data={data} margin={compact ? { left: 0, right: 0, top: 2, bottom: 0 } : { left: -16, right: 4, top: 4, bottom: 0 }}>
        {compact ? null : <CartesianGrid stroke="var(--color-ds-ash)" vertical={false} />}
        {compact ? null : (
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={xTickFormatter}
            fontSize={11}
            stroke="var(--color-ds-fog)"
          />
        )}
        {compact ? null : (
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            allowDecimals={false}
            fontSize={11}
            width={28}
            stroke="var(--color-ds-fog)"
          />
        )}
        <ChartTooltip
          cursor={compact ? false : { fill: "var(--color-ds-paper-mist)" }}
          content={
            <ChartTooltipContent
              indicator="dot"
              hideLabel={compact}
              className="rounded-ds-buttons border-ds-ash shadow-ds-md"
            />
          }
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            fill={`var(--color-${s.key})`}
            radius={compact ? [2, 2, 0, 0] : [6, 6, 0, 0]}
            maxBarSize={compact ? 8 : 32}
          />
        ))}
        {!compact && series.length > 1 ? (
          <ChartLegend content={<ChartLegendContent className="font-ds-inter text-ds-caption text-ds-fog" />} />
        ) : null}
      </BarChart>
    </ChartContainer>
  );
}
