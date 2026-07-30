"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { Area, AreaChart } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { MiniDonut } from "./mini-donut";
import { cardItemVariants } from "@/shared/animations";

export type StatCardProps = {
  /** Rótulo exibido no topo do card */
  label: string;
  /** Valor principal (aceita string ou número) */
  value: string | number;
  /** Texto secundário abaixo do valor */
  sublabel?: string;
  /** Ícone opcional mostrado em um box colorido ao lado do label */
  icon?: React.ComponentType<{ className?: string }>;
  /** Classes para personalizar o fundo/cor do ícone (ex: "bg-primary/10 text-primary") */
  iconClassName?: string;
  /** Direção da tendência (up = positivo, down = negativo) */
  trend?: "up" | "down" | "neutral";
  /** Texto do badge de variação */
  change?: string;
  /** Variante do badge (default: calculada a partir do trend) */
  changeVariant?: "success" | "destructive" | "warning" | "secondary";
  /** Segmentos para exibir um MiniDonut opcional */
  chartSegments?: Array<{ name: string; value: number; color: string }>;
  /** Dados para exibição de mini gráfico de linha (sparkline) usando shadcn Chart */
  sparklineData?: number[] | Array<Record<string, any>>;
  /** Cor da linha do gráfico (ex: "var(--chart-1)") */
  sparklineColor?: string;
  /** Nome da chave dos dados se for um array de objetos (default: "value") */
  sparklineDataKey?: string;
  /** Classes personalizadas para o valor */
  valueClassName?: string;
  /** Classes adicionais no card */
  className?: string;
  /** Ativa animação de entrada fade-in + slide-up (cardItemVariants) */
  animated?: boolean;
  /** Atraso da animação em segundos (ex: 0.08 para efeito cascata) */
  animationDelay?: number;
  /** Variante visual para métricas isoladas ou agrupadas em uma visão geral. */
  variant?: "default" | "overview";
};

/**
 * StatCard — componente único e padronizado para exibir métricas e estatísticas.
 *
 * Suporta:
 * - Ícone opcional com fundo colorido
 * - Badge de tendência/variação
 * - Gráfico de linha (sparkline) via shadcn Chart
 * - Gráfico MiniDonut opcional
 * - Valor com cor personalizada
 * - Label + sublabel opcional
 * - Animação de entrada fade-in + slide-up (animated + animationDelay)
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
  trend,
  change,
  changeVariant,
  chartSegments,
  sparklineData,
  sparklineColor,
  sparklineDataKey,
  valueClassName,
  className,
  animated,
  animationDelay = 0,
  variant = "default",
}: StatCardProps) {
  const uniqueId = useId().replace(/:/g, "");
  const dataKey = sparklineDataKey || "value";
  const lineColor = sparklineColor || "var(--primary)";

  const formattedSparklineData = (sparklineData ?? []).map((item, idx) => {
    if (typeof item === "number") {
      return { [dataKey]: item, index: idx };
    }
    return item;
  });

  const chartConfig = {
    [dataKey]: {
      label,
      color: lineColor,
    },
  } satisfies ChartConfig;

  const resolvedVariant =
    changeVariant ??
    (trend === "up" ? "success" : trend === "down" ? "destructive" : "secondary");

  const TrendIcon =
    trend === "up"
      ? ArrowUpRight
      : trend === "down"
        ? ArrowDownRight
        : null;

  const card = (
    <Card
      variant={variant === "overview" ? "overview" : "compact"}
      className={cn(
        "group/card h-full min-w-0",
        variant === "overview" ? "rounded-none border-0 border-r border-border/70 last:border-r-0" : "hover:bg-card/95",
        className,
      )}
    >
      <div className={variant === "overview" ? "flex min-w-0 items-center justify-between gap-2 p-4 pb-3" : "flex min-w-0 items-center justify-between gap-2 pb-2"}>
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground/80 transition-[background-color,color] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover/card:bg-foreground/10 group-hover/card:text-foreground motion-reduce:transition-none",
                iconClassName,
              )}
            >
              <Icon className="size-4" />
            </div>
          )}
          <span className="truncate text-xs font-medium text-muted-foreground transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover/card:text-foreground motion-reduce:transition-none">
            {label}
          </span>
        </div>
        {(trend || change) && (
          <Badge
            className="shrink-0 rounded-full font-mono text-[11px] font-medium"
            variant={resolvedVariant}
          >
            {trend && trend !== "neutral" && TrendIcon && (
              <TrendIcon className="mr-0.5 size-2.5" />
            )}
            {change}
          </Badge>
        )}
      </div>
      <div className={variant === "overview" ? "flex items-end justify-between gap-3 px-4 pb-4" : "flex items-end justify-between gap-3 pt-1"}>
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums text-foreground",
              valueClassName,
            )}
          >
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs leading-tight text-muted-foreground transition-colors duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover/card:text-foreground/70 motion-reduce:transition-none">
              {sublabel}
            </p>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 ? (
          <div className="h-10 w-24 shrink-0 overflow-hidden">
            <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
              <AreaChart data={formattedSparklineData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                <defs>
                  <linearGradient id={`sparkline-grad-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={lineColor}
                  strokeWidth={2}
                  fill={`url(#sparkline-grad-${uniqueId})`}
                  isAnimationActive={true}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : chartSegments && chartSegments.length > 0 ? (
          <MiniDonut segments={chartSegments} showCenterText={false} />
        ) : null}
      </div>
    </Card>
  );

  if (!animated) return card;

  return (
    <motion.div
      variants={cardItemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: animationDelay }}
      className="h-full"
    >
      {card}
    </motion.div>
  );
}

// ─── Alias para retrocompatibilidade ─────────────────────────────────────────

export type MetricCardProps = StatCardProps;

/**
 * @deprecated Use `StatCard` — mais flexível e padronizado.
 *   `MetricCard` continua funcionando como alias.
 */
export function MetricCard(props: MetricCardProps) {
  return <StatCard {...props} />;
}
