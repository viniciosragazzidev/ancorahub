import { cn } from "@/lib/utils";
import type { ComparisonDelta } from "@/features/reports/metrics/metrics-math";
import { TrendUp, TrendDown } from "@/components/huge-icons";
import type { ComponentType } from "react";

interface IconComponentProps {
  className?: string;
}

interface KpiComparisonCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly sublabel: string;
  readonly icon: ComponentType<IconComponentProps>;
  readonly iconClassName?: string;
  readonly delta?: ComparisonDelta;
  readonly isCurrency?: boolean;
}

function formatDelta(delta: ComparisonDelta, unit: "pp" | "currency" | "number"): string {
  if (delta.percentagePoints !== null) {
    const sign = delta.percentagePoints > 0 ? "+" : "";
    return `${sign}${delta.percentagePoints.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp`;
  }
  if (delta.relativePercent !== null) {
    const val = delta.relativePercent;
    if (unit === "currency") {
      const formatted = Math.abs(val).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return val >= 0 ? `+${formatted}%` : `-${formatted}%`;
    }
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
  return "";
}

function DeltaBadge({ delta, unit }: { delta: ComparisonDelta; unit: "pp" | "currency" | "number" }) {
  if (delta.direction === "flat") return null;

  const isPositive = delta.direction === "up";
  const formatted = formatDelta(delta, unit);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums",
        isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
      )}
    >
      {isPositive ? <TrendUp className="size-3" aria-hidden="true" /> : <TrendDown className="size-3" aria-hidden="true" />}
      {formatted}
    </span>
  );
}

export function KpiComparisonCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconClassName,
  delta,
  isCurrency,
}: KpiComparisonCardProps) {
  return (
    <div data-slot="report-card" className="report-card ui-metric-card min-w-0 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div className={cn("ui-metric-card-icon flex size-9 items-center justify-center", iconClassName)}>
          <Icon className="size-4" />
        </div>
        {delta && <DeltaBadge delta={delta} unit={isCurrency ? "currency" : "number"} />}
      </div>
      <div className="mt-3">
        <p className="ui-metric-card-value truncate text-lg font-semibold sm:text-2xl" title={String(value)}>{value}</p>
        <p className="ui-metric-card-label">{label}</p>
      </div>
      <p className="ui-metric-card-label mt-1">{sublabel}</p>
    </div>
  );
}
