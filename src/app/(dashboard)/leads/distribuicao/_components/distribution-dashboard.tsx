"use client";

import { motion } from "motion/react";
import { Buildings, Users, WifiHigh, TrendUp, Power } from "@/components/huge-icons";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type Metrics = {
  totalBranches: number;
  acceptingBranches: number;
  autoDistributeBranches: number;
  totalBrokers: number;
  totalAvailable: number;
  totalNewLeads: number;
};

export function DistributionMetrics({ metrics }: { metrics: Metrics }) {
  const acceptingRate =
    metrics.totalBranches > 0
      ? Math.round((metrics.acceptingBranches / metrics.totalBranches) * 100)
      : 0;
  const autoRate =
    metrics.totalBranches > 0
      ? Math.round((metrics.autoDistributeBranches / metrics.totalBranches) * 100)
      : 0;

  return (
    <motion.div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
      }}
    >
      {[
        {
          label: "Filiais",
          value: metrics.totalBranches,
          sub: `${metrics.acceptingBranches} aceitando leads`,
          icon: Buildings,
          tone: "bg-primary/10 text-primary",
        },
        {
          label: "Recebendo leads",
          value: `${metrics.acceptingBranches}/${metrics.totalBranches}`,
          sub: `${acceptingRate}% das filiais`,
          icon: WifiHigh,
          tone:
            acceptingRate > 50
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        },
        {
          label: "Distribuição automática",
          value: `${metrics.autoDistributeBranches}/${metrics.totalBranches}`,
          sub: `${autoRate}% das filiais`,
          icon: TrendUp,
          tone:
            autoRate > 50
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        },
        {
          label: "Corretores disponíveis",
          value: metrics.totalAvailable,
          sub: `${metrics.totalBrokers} corretores vinculados`,
          icon: Users,
          tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
        },
        {
          label: "Leads novos",
          value: metrics.totalNewLeads,
          sub: "Aguardando primeiro contato",
          icon: Power,
          tone:
            metrics.totalNewLeads > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground",
        },
      ].map((metric) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] } },
            }}
          >
            <Card variant="compact" className="group/card">
              <CardContent className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground">
                    {metric.label}
                  </p>
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-md",
                      metric.tone,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                </div>
                <p className="font-mono text-2xl font-semibold tabular-nums transition-colors duration-200 group-hover/card:text-primary">
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground">{metric.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
