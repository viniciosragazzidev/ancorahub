"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  /** Classes personalizadas para o valor */
  valueClassName?: string;
  /** Classes adicionais no card */
  className?: string;
  /** Ativa animação de entrada fade-in + slide-up (cardItemVariants) */
  animated?: boolean;
  /** Atraso da animação em segundos (ex: 0.08 para efeito cascata) */
  animationDelay?: number;
};

/**
 * StatCard — componente único e padronizado para exibir métricas e estatísticas.
 *
 * Suporta:
 * - Ícone opcional com fundo colorido
 * - Badge de tendência/variacão
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
  valueClassName,
  className,
  animated,
  animationDelay = 0,
}: StatCardProps) {
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
      className={cn(
        "group/card h-full min-w-0 rounded-2xl border border-border bg-card p-6 shadow-none transition-all duration-200 hover:border-border-strong hover:bg-card/95 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-2 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground/80 transition-all duration-200 group-hover/card:scale-105 group-hover/card:bg-foreground/10 group-hover/card:text-foreground",
                iconClassName,
              )}
            >
              <Icon className="size-4" />
            </div>
          )}
          <span className="truncate font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground">
            {label}
          </span>
        </div>
        {(trend || change) && (
          <Badge
            className="shrink-0 rounded-full font-mono text-[11px] font-medium transition-transform duration-200 group-hover/card:scale-105"
            variant={resolvedVariant}
          >
            {trend && trend !== "neutral" && TrendIcon && (
              <TrendIcon className="mr-0.5 size-2.5 transition-transform duration-200 group-hover/card:translate-x-px group-hover/card:-translate-y-px" />
            )}
            {change}
          </Badge>
        )}
      </div>
      <div className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p
            className={cn(
              "text-2xl font-bold tracking-tight tabular-nums text-foreground transition-colors duration-200",
              valueClassName,
            )}
          >
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 font-mono text-[11px] leading-tight text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground/70">
              {sublabel}
            </p>
          )}
        </div>
        {chartSegments && chartSegments.length > 0 && (
          <MiniDonut segments={chartSegments} showCenterText={false} />
        )}
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
