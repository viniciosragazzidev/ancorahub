"use client";

import { motion } from "motion/react";
import {
  ArrowUpRight,
  ChartLineUp,
  Target,
} from "@/components/huge-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import type { GoalRecord } from "@/features/goals/queries";

type BrokerGoalViewProps = {
  goal: GoalRecord | null;
};

const targetTypeIcons: Record<string, string> = {
  sales_count: "Vendas",
  revenue: "Receita",
  conversion_rate: "Conversão",
  leads_contacted: "Contatos",
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

function formatTargetValue(value: string, targetType: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  if (targetType === "revenue") {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  }
  if (targetType === "conversion_rate") {
    return `${num.toFixed(0)}%`;
  }
  return new Intl.NumberFormat("pt-BR").format(num);
}

export function BrokerGoalView({ goal }: BrokerGoalViewProps) {
  if (!goal) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <ChartLineUp className="size-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-lg font-medium">Nenhuma meta atribuída</p>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
          Sua gestão ainda não definiu uma meta para este período. Assim que for criada,
          você verá seu progresso aqui.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Target className="size-3.5" />
          <span>As metas são configuradas pelo diretor ou gestor da sua filial</span>
        </div>
      </div>
    );
  }

  const pct = goal.progressPercentage
    ? Math.min(100, Math.max(0, parseFloat(goal.progressPercentage)))
    : 0;
  const current = goal.progressCurrentValue ?? "0";

  const progressColor =
    pct >= 100 ? "from-emerald-500 to-emerald-400" :
    pct >= 60 ? "from-primary to-primary/80" :
    pct >= 30 ? "from-amber-500 to-amber-400" :
    "from-rose-500 to-rose-400";

  const progressBgColor =
    pct >= 100 ? "bg-emerald-500" :
    pct >= 60 ? "bg-primary" :
    pct >= 30 ? "bg-amber-500" :
    "bg-rose-500";

  return (
    <div className="space-y-8">
      {/* Big goal card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
      >
        <Card className="border-border bg-card shadow-none overflow-hidden">
          <div className={`h-1.5 w-full bg-gradient-to-r ${progressColor}`} />
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Badge variant="secondary" className="w-fit">
                  {goal.period}
                </Badge>
                <h2 className="text-xl font-semibold tracking-tight">{goal.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {targetTypeIcons[goal.targetType] ?? goal.targetType}
                  {goal.targetType === "revenue" ? " acumulada no período" :
                   goal.targetType === "sales_count" ? " realizadas no período" :
                   goal.targetType === "conversion_rate" ? " de leads para vendas" :
                   " realizados no período"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-4xl font-bold tracking-tight tabular-nums">
                  {formatValue(current, goal.targetType)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  meta: {formatTargetValue(goal.targetValue, goal.targetType)}
                </p>
              </div>
            </div>

            {/* Large progress bar */}
            <div className="mt-8">
              <div className="relative h-4 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${progressBgColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1.2, ease: [0, 0, 0.2, 1] }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Progresso
                </span>
                <span className={`text-2xl font-bold tabular-nums ${pct >= 100 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Milestone indicators */}
            <div className="mt-6 grid grid-cols-4 gap-2">
              {[25, 50, 75, 100].map((milestone) => (
                <div key={milestone} className="text-center">
                  <div className={`h-1 rounded-full transition-colors duration-500 ${pct >= milestone ? progressBgColor : "bg-muted"}`} />
                  <span className={`mt-1 block text-[10px] uppercase tracking-wider ${pct >= milestone ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {milestone}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info cards */}
      <motion.div
        className="grid gap-4 sm:grid-cols-2"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
        }}
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
          }}
        >
          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Faltam</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                {(() => {
                  const target = parseFloat(goal.targetValue);
                  const curr = parseFloat(current);
                  const remaining = Math.max(0, target - curr);
                  if (goal.targetType === "revenue") {
                    return new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(remaining);
                  }
                  return new Intl.NumberFormat("pt-BR").format(Math.round(remaining));
                })()}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">para atingir a meta</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.18 } },
          }}
        >
          <Card className="border-border bg-card shadow-none">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Período</p>
              <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                {goal.period}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(goal.startDate).toLocaleDateString("pt-BR")} — {new Date(goal.endDate).toLocaleDateString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" render={<Link href="/vendas" />}>
          <ArrowUpRight className="size-4" />
          Ver minhas vendas
        </Button>
      </div>
    </div>
  );
}
