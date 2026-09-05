"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";

type LeadTrend = Array<{ date: string; leads: number; converted: number }>;

const chartConfig = {
  leads: {
    label: "Leads",
    color: "var(--primary)",
  },
  converted: {
    label: "Convertidos",
    color: "var(--chart-2)",
  },
} as const;

type LeadTrendChartProps = {
  data: LeadTrend;
  /** Número de dias para exibir. Últimos N dias do array. */
  days?: number;
};

export function LeadTrendChart({ data, days = 30 }: LeadTrendChartProps) {
  const sliced = days < data.length ? data.slice(-days) : data;

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-52 w-full"
      initialDimension={{ width: 320, height: 200 }}
    >
      <LineChart data={sliced} margin={{ left: -12, right: 4, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => {
            const [y, m, d] = value.split("-").map(Number);
            return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
          }}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          allowDecimals={false}
          fontSize={11}
          width={24}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(label) => {
                if (typeof label !== "string") return label;
                const [y, m, d] = label.split("-").map(Number);
                const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
                const date = new Date(y, m - 1, d);
                return `${days[date.getDay()]}, ${d} de ${months[date.getMonth()]}`;
              }}
            />
          }
        />
        <Line
          dataKey="leads"
          type="monotone"
          stroke="var(--color-leads)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
        <Line
          dataKey="converted"
          type="monotone"
          stroke="var(--color-converted)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
          strokeDasharray="4 3"
        />
      </LineChart>
    </ChartContainer>
  );
}
