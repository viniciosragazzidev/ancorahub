"use client";

import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type ReportTrend = {
  date: string;
  leads: number;
  clients: number;
  sales: number;
  revenue: number;
};

const commercialChartConfig = {
  leads: { label: "Leads", color: "var(--chart-1)" },
  clients: { label: "Clientes", color: "var(--chart-5)" },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: { label: "Receita ativa", color: "var(--success)" },
  sales: { label: "Vendas", color: "var(--chart-2)" },
} satisfies ChartConfig;

function formatDay(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function formatFullDay(value: ReactNode) {
  if (typeof value !== "string") return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(
    new Date(`${value}T12:00:00`),
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function ReportTrendCharts({ data, period }: { data: ReportTrend[]; period: number }) {
  const hasCommercialData = data.some((item) => item.leads > 0 || item.clients > 0);
  const hasRevenueData = data.some((item) => item.revenue > 0 || item.sales > 0);

  return (
    <section className="grid gap-4 xl:grid-cols-5" aria-label="Evolução dos indicadores">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Evolução comercial</CardTitle>
          <CardDescription>
            Leads recebidos e clientes convertidos nos últimos {period} dias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasCommercialData ? (
            <ChartContainer
              config={commercialChartConfig}
              className="h-64 w-full aspect-auto"
              initialDimension={{ width: 560, height: 256 }}
              aria-label="Gráfico de leads recebidos e clientes convertidos"
            >
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  tickFormatter={formatDay}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={28}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={<ChartTooltipContent indicator="dot" labelFormatter={formatFullDay} />}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="var(--color-leads)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="clients"
                  stroke="var(--color-clients)"
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <ChartEmpty message="Ainda não há leads ou conversões neste período." />
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Receita ativa</CardTitle>
          <CardDescription>Valor das vendas ativas registradas no período.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasRevenueData ? (
            <ChartContainer
              config={revenueChartConfig}
              className="h-64 w-full aspect-auto"
              initialDimension={{ width: 420, height: 256 }}
              aria-label="Gráfico de receita ativa por dia"
            >
              <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                <defs>
                  <linearGradient id="report-revenue-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  tickFormatter={formatDay}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={44}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat("pt-BR", {
                      notation: "compact",
                      maximumFractionDigits: 0,
                    }).format(value)
                  }
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={formatFullDay}
                      formatter={(value) => (
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          {Number(value).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      )}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  fill="url(#report-revenue-gradient)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <ChartEmpty message="Ainda não há vendas ativas neste período." />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
