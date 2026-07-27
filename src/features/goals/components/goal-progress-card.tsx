"use client";

import { motion } from "motion/react";
import { Target } from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

const targetTypeLabels: Record<string, string> = {
  sales_count: "Vendas",
  revenue: "Receita",
  conversion_rate: "Conversão",
  leads_contacted: "Contatos",
};

const scopeLabels: Record<string, string> = {
  broker: "Corretor",
  team: "Equipe",
  branch: "Filial",
  tenant: "Corretora",
};

type GoalProgressCardProps = {
  name: string;
  scope: string;
  scopeName: string | null;
  targetType: string;
  targetValue: string;
  currentValue: string | null;
  percentage: string | null;
  period: string;
  compact?: boolean;
};

function formatValue(value: string, targetType: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  if (targetType === "revenue") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  }
  if (targetType === "conversion_rate") {
    return `${num.toFixed(1)}%`;
  }
  return new Intl.NumberFormat("pt-BR").format(num);
}

export function GoalProgressCard({
  name,
  scope,
  scopeName,
  targetType,
  targetValue,
  currentValue,
  percentage,
  period,
  compact,
}: GoalProgressCardProps) {
  const pct = percentage ? Math.min(100, Math.max(0, parseFloat(percentage))) : 0;
  const current = currentValue ?? "0";
  const progressColor =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 60 ? "bg-primary" :
    pct >= 30 ? "bg-amber-500" :
    "bg-rose-500";

  const formattedCurrent = formatValue(current, targetType);
  const formattedTarget = formatValue(targetValue, targetType);

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium truncate">{name}</span>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">{period}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${progressColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0, 0, 0.2, 1] }}
            />
          </div>
          <span className={`text-xs font-semibold tabular-nums shrink-0 ${pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
            {pct.toFixed(0)}%
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formattedCurrent} / {formattedTarget}</span>
          {scopeName && (
            <span className="truncate ml-2">{scopeName}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm group/card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Target className="size-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold truncate">{name}</h3>
              <Badge variant="secondary" className="shrink-0">
                {scopeLabels[scope] ?? scope}
              </Badge>
            </div>
            {scopeName && (
              <p className="mt-0.5 text-xs text-muted-foreground">{scopeName}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {formattedCurrent}
            </p>
            <p className="text-xs text-muted-foreground">
              meta: {formattedTarget}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="relative h-3 overflow-hidden rounded-full bg-muted">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${progressColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: [0, 0, 0.2, 1] }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {targetTypeLabels[targetType] ?? targetType} · {period}
            </span>
            <span className={`text-sm font-semibold tabular-nums ${pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
              {pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
