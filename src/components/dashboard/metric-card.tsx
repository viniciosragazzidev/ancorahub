import { ArrowDownRight, ArrowUpRight, InfoIcon } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MiniDonut } from "./mini-donut";
import { MetricSparkline } from "./metric-sparkline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Tom do chip e do número (docs/design-system.md § Stat / KPI Tile). Semântico só quando o número é um status real. */
export type StatCardTone = "default" | "success" | "warning" | "destructive";

/** Classes do chip por tom; reaproveitadas pelos cards de número que ainda não são `StatCard`. */
export const STAT_TONE_CHIP: Record<StatCardTone, string> = {
  default: "bg-ds-powder-blue text-ds-electric-blue",
  success: "bg-ds-soft-mint text-ds-forest-ink",
  warning: "bg-ds-amber-wash text-ds-amber-ink",
  destructive: "bg-ds-rose-wash text-ds-rose-ink",
};

export type StatCardProps = {
  /** Rótulo exibido no topo do card */
  label: string;
  /** Valor principal (aceita string ou número) */
  value: string | number;
  /** Texto secundário abaixo do valor */
  sublabel?: string;
  /** Ícone opcional mostrado em um box colorido ao lado do label */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Tom do chip do ícone. Azul por padrão; success/warning/destructive só quando o número
   * representa um status real (ex.: "SLA vencido"), nunca para variar a cor de uma grade.
   */
  tone?: StatCardTone;
  /** Explicação curta do número, no `(i)` à direita do rótulo. */
  info?: string;
  /** @deprecated Use `tone`. Classes extras no chip do ícone (geometria ou casos já aprovados). */
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
  /** @deprecated A entrada vem da rota (etapa 2 do plano de movimento); mantido só por compatibilidade. */
  animated?: boolean;
  /** @deprecated Ver `animated`. */
  animationDelay?: number;
  /** Variante visual para métricas isoladas ou agrupadas em uma visão geral. */
  variant?: "default" | "overview";
};

/**
 * StatCard — o card de número canônico (docs/design-system.md § Stat / KPI Tile; plano
 * docs/implementations/active/2026-11-18-refinamento-movimento-areas.md, etapa 1).
 *
 * Anatomia: chip de ícone 28px (radius 8px, azul por padrão) · rótulo · `(i)` opcional ·
 * número em Geist Mono 24px com `tabular-nums` · linha de contexto · variação opcional.
 * Borda fina, sem sombra e parado no hover: card informativo não se mexe.
 * O número aparece pronto (nível 0 de FEEDBACK.md); nada conta do zero.
 * Vários números juntos: use `MetricGrid`.
 */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
  info,
  iconClassName,
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
  const dataKey = sparklineDataKey || "value";
  const lineColor = sparklineColor || "var(--chart-1)";

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
      data-slot="stat-card"
      variant={variant === "overview" ? "overview" : "compact"}
      className={cn(
        "ui-metric-card group/card h-full min-w-0",
        variant === "overview" && "rounded-none shadow-none",
        className,
      )}
    >
      <div className={variant === "overview" ? "flex min-w-0 items-center justify-between gap-2 p-4 pb-3" : "flex min-w-0 items-center justify-between gap-2 pb-2"}>
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <div
              aria-hidden="true"
              className={cn(
                "ui-metric-card-icon flex size-7 shrink-0 items-center justify-center rounded-ds-buttons",
                STAT_TONE_CHIP[tone],
                iconClassName,
              )}
            >
              <Icon className="size-4" />
            </div>
          )}
          <span className="ui-metric-card-label truncate">{label}</span>
          {info ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button type="button" aria-label={`Sobre ${label}`} className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
                    <InfoIcon className="size-3.5" />
                  </button>
                }
              />
              <TooltipContent className="max-w-60">{info}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {(trend || change) && (
          <Badge
            className="shrink-0 rounded-full text-[11px] font-medium"
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
              "ui-metric-card-value font-ds-mono text-ds-heading-sm font-semibold tabular-nums text-foreground",
              valueClassName,
            )}
          >
            {value}
          </p>
          {sublabel && (
            <p className="ui-metric-card-label mt-1 text-[12px] leading-tight text-muted-foreground">
              {sublabel}
            </p>
          )}
        </div>
        {sparklineData && sparklineData.length > 0 ? (
          <MetricSparkline label={label} data={sparklineData} color={lineColor} dataKey={dataKey} />
        ) : chartSegments && chartSegments.length > 0 ? (
          <MiniDonut segments={chartSegments} showCenterText={false} />
        ) : null}
      </div>
    </Card>
  );

  return animated ? (
    <div data-animated="true" data-animation-delay={animationDelay} className="h-full">
      {card}
    </div>
  ) : card;
}

// ─── Grade de números ───────────────────────────────────────────────────────

/**
 * Vários números num container só, com divisórias de 1px entre as células (como a grade
 * "Consultas hoje / Sala de espera / Comparecimento" da referência). Os filhos são
 * `StatCard variant="overview"`. Cada célula desenha a borda direita e a de baixo e avança 1px
 * sobre a vizinha; o container corta as da última coluna e da última linha. Linha incompleta
 * fica em branco, sem bloco cinza.
 */
export function MetricGrid({
  children,
  columns = 4,
  className,
  label,
  style,
}: {
  children: React.ReactNode;
  /** Colunas no desktop; no celular são sempre 2 (1 quando `columns` é 1). */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  /** Nome do grupo para leitor de tela. */
  label?: string;
  /** Ex.: `--enter-offset` quando a grade entra em sequência (`ct-enter-seq-tight`). */
  style?: React.CSSProperties;
}) {
  const cols = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
  }[columns];
  return (
    <section
      data-slot="metric-grid"
      aria-label={label}
      style={style}
      className={cn(
        "grid overflow-hidden rounded-[var(--radius-card)] border border-border bg-card",
        "[&>*]:-mr-px [&>*]:-mb-px [&>*]:border-t-0! [&>*]:border-l-0! [&>*]:border-r! [&>*]:border-b! [&>*]:border-border",
        cols,
        className,
      )}
    >
      {children}
    </section>
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
