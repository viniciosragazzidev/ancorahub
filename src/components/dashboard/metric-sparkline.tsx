"use client";

import { useId } from "react";
import { Area, AreaChart } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

type MetricSparklineProps = {
  label: string;
  data: number[] | Array<Record<string, unknown>>;
  color: string;
  dataKey: string;
};

export function MetricSparkline({
  label,
  data,
  color,
  dataKey,
}: MetricSparklineProps) {
  const uniqueId = useId().replace(/:/g, "");
  const formattedData = data.map((item, index) =>
    typeof item === "number" ? { [dataKey]: item, index } : item,
  );
  const chartConfig = {
    [dataKey]: { label, color },
  } satisfies ChartConfig;

  return (
    <div className="h-10 w-24 shrink-0 overflow-hidden" aria-hidden="true">
      <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
        <AreaChart data={formattedData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <defs>
            <linearGradient id={`sparkline-grad-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#sparkline-grad-${uniqueId})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
