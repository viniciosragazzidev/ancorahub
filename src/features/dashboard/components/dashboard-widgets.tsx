"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  CheckCircle,
  ChartBar,
  TrendUp,
  Users,
  Warning,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import type { DashboardViewData } from "../service";

const trendConfig = {
  received: { label: "Recebidos", color: "var(--chart-1)" },
  converted: { label: "Convertidos", color: "var(--chart-2)" },
} satisfies ChartConfig;

const qualificationConfig = {
  qualified: { label: "Qualificados", color: "var(--chart-1)" },
  hot: { label: "Quentes", color: "var(--chart-5)" },
  warm: { label: "Mornos", color: "var(--chart-4)" },
  cold: { label: "Frios", color: "var(--chart-3)" },
  pending: { label: "Pendentes", color: "var(--muted-foreground)" },
  qualifying: { label: "Em qualificação", color: "var(--chart-2)" },
  disqualified: { label: "Desqualificados", color: "var(--destructive)" },
} satisfies ChartConfig;

const qualificationColors = [
  "var(--chart-1)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--muted-foreground)",
  "var(--chart-2)",
  "var(--destructive)",
];

const qualificationLabel: Record<string, string> = {
  qualified: "Qualificados",
  hot: "Quentes",
  warm: "Mornos",
  cold: "Frios",
  pending: "Pendentes",
  qualifying: "Em qualificação",
  disqualified: "Desqualificados",
};

type Metric = DashboardViewData["metrics"][number];

function IconBox({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: Metric["tone"];
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 items-center justify-center rounded-lg [&>svg]:size-4",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "danger" && "bg-destructive/10 text-destructive",
        (!tone || tone === "default") && "bg-primary/8 text-primary",
      )}
    >
      {children}
    </span>
  );
}

export function DashboardMetricCard({ metric, icon }: { metric: Metric; icon: React.ReactNode }) {
  const tone = metric.tone ?? "default";
  return (
    <Card className="h-full transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-sm motion-reduce:transform-none motion-reduce:transition-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <IconBox tone={tone}>{icon}</IconBox>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-medium">{metric.label}</CardTitle>
            <CardDescription className="mt-1 truncate">{metric.description}</CardDescription>
          </div>
        </div>
        <Badge
          variant={
            tone === "warning"
              ? "warning"
              : tone === "danger"
                ? "destructive"
                : tone === "success"
                  ? "success"
                  : "outline"
          }
        >
          {tone === "warning"
            ? "Atenção"
            : tone === "danger"
              ? "Crítico"
              : tone === "success"
                ? "Saudável"
                : "Período"}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
          {metric.value}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Indicador calculado no escopo autorizado.
        </p>
      </CardContent>
    </Card>
  );
}

export function TrendPanel({
  trend,
  period,
}: {
  trend: DashboardViewData["trend"];
  period: number;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const hasData = trend.some((point) => point.received > 0 || point.converted > 0);

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary [&>svg]:size-4"
            aria-hidden="true"
          >
            <TrendUp />
          </span>
          <div>
            <CardTitle>Evolução da operação</CardTitle>
            <CardDescription>Entradas e conversões nos últimos {period} dias.</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">Atualizado no período</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer
            config={trendConfig}
            className="h-[250px] w-full aspect-auto"
            aria-label="Evolução diária de leads recebidos e convertidos"
          >
            <LineChart data={trend} margin={{ top: 12, right: 12, bottom: 4, left: -18 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={28}
                tickFormatter={(value: string) => value.slice(8)}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={28}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)" }}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Line
                type="monotone"
                dataKey="received"
                stroke="var(--color-received)"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={!reduceMotion}
              />
              <Line
                type="monotone"
                dataKey="converted"
                stroke="var(--color-converted)"
                strokeWidth={2.5}
                dot={false}
                strokeDasharray="5 4"
                isAnimationActive={!reduceMotion}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <EmptyWidget
            title="Sem movimentação no período"
            description="O gráfico será preenchido quando novos leads forem recebidos."
          />
        )}
      </CardContent>
      {hasData ? (
        <div className="border-t border-border/70 px-5 py-3">
          <ChartLegend content={<ChartLegendContent className="text-xs" />} />
        </div>
      ) : null}
    </Card>
  );
}

export function AttentionPanel({ items }: { items: DashboardViewData["attention"] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-warning/10 text-warning [&>svg]:size-4"
            aria-hidden="true"
          >
            <Warning />
          </span>
          <div>
            <CardTitle>O que exige atenção</CardTitle>
            <CardDescription>Exceções que podem bloquear o fluxo comercial.</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant={items.length ? "warning" : "success"}>
            {items.length ? `${items.length} itens` : "Tudo certo"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.tone === "danger" ? "bg-destructive" : "bg-warning",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Badge variant={item.tone === "danger" ? "destructive" : "warning"}>
                    {item.count}
                  </Badge>
                  <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyWidget
            icon={<CheckCircle />}
            title="Nenhuma exceção operacional"
            description="A distribuição e o acompanhamento estão dentro do esperado."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function QualificationPanel({ rows }: { rows: DashboardViewData["qualifications"] }) {
  const reduceMotion = useReducedMotion() ?? false;
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const chartData = rows.map((row) => ({
    key: row.status,
    label: qualificationLabel[row.status] ?? row.status,
    value: row.count,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-chart-4/10 text-chart-4 [&>svg]:size-4"
            aria-hidden="true"
          >
            <ChartBar />
          </span>
          <div>
            <CardTitle>Qualificação</CardTitle>
            <CardDescription>Distribuição dos leads no período.</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">{total} leads</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rows.length ? (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
            <ChartContainer
              config={qualificationConfig}
              className="mx-auto h-[190px] w-full max-w-[220px] aspect-square"
              aria-label="Distribuição dos leads por qualificação"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="var(--card)"
                  strokeWidth={3}
                  isAnimationActive={!reduceMotion}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={qualificationColors[index % qualificationColors.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2.5">
              {chartData.slice(0, 6).map((row, index) => (
                <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: qualificationColors[index % qualificationColors.length],
                      }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-muted-foreground">{row.label}</span>
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyWidget
            title="Nenhuma qualificação registrada"
            description="Os dados aparecerão quando os leads forem qualificados."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function PerformancePanel({
  title,
  description,
  rows,
  valueLabel,
  suffixLabel,
}: {
  title: string;
  description: string;
  rows: Array<{ id: string; name: string; received: number; suffix: string }>;
  valueLabel: string;
  suffixLabel: string;
}) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3 [&>svg]:size-4"
            aria-hidden="true"
          >
            <Users />
          </span>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="outline">Top {Math.min(rows.length, 6)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="-mx-[var(--size-spacing-05)] -mb-[var(--size-spacing-05)]">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">{valueLabel}</TableHead>
                <TableHead className="text-right">{suffixLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 6).map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="truncate font-medium">{row.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {row.received}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {row.suffix}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-5">
            <EmptyWidget
              title="Sem dados para comparar"
              description="Não há movimentação suficiente no período selecionado."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecentPanel({
  title,
  description,
  rows,
  emptyLabel,
  href,
  formatDate,
}: {
  title: string;
  description: string;
  rows: Array<{ id: string; label: string; detail: string; date: string }>;
  emptyLabel: string;
  href: string;
  formatDate: (value: string) => string;
}) {
  return (
    <Card className="h-full overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <CardAction>
          <Link
            href={href}
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver todos
            <ArrowUpRight className="size-3.5" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-0">
        {rows.length ? (
          rows.slice(0, 5).map((row, index) => (
            <div key={row.id}>
              {index > 0 ? <Separator /> : null}
              <div className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.detail}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(row.date)}
                </time>
              </div>
            </div>
          ))
        ) : (
          <EmptyWidget
            title={emptyLabel}
            description="Nenhum registro foi encontrado para o período."
          />
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyWidget({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/80 bg-muted/20 px-5 py-6 text-center">
      <span
        className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-4"
        aria-hidden="true"
      >
        {icon ?? <ChartBar />}
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
