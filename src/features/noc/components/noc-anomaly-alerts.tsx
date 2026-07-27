"use client";

import React, { useState } from "react";
import Link from "next/link";
import { WarningCircle, ArrowRight, CheckCircle, Warning } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import type { BranchHealth } from "@/features/noc/queries";

export function NocAnomalyAlerts({ branches }: { branches: BranchHealth[] }) {
  const anomalies = branches.filter((b) => b.health !== "healthy");
  const [dismissed, setDismissed] = useState<string[]>([]);

  const visibleAnomalies = anomalies.filter((a) => !dismissed.includes(a.id));

  if (visibleAnomalies.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {visibleAnomalies.map((branch) => {
        const isCritical = branch.health === "critical";

        return (
          <div
            key={branch.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 shadow-xs transition-all ${
              isCritical
                ? "border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-200"
                : "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  isCritical ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                }`}
              >
                {isCritical ? <WarningCircle className="size-5" /> : <Warning className="size-5" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Alerta de Anomalia na Operação — {branch.name}</span>
                </div>
                <p className="text-xs mt-0.5 opacity-90">{branch.healthReason}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <Button
                size="sm"
                variant={isCritical ? "destructive" : "outline"}
                render={<Link href="/leads/distribuicao" />}
                className="h-8 text-xs gap-1.5 font-medium"
              >
                Resolver Fila <ArrowRight className="size-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed((prev) => [...prev, branch.id])}
                className="h-8 text-xs text-muted-foreground"
              >
                Ignorar
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
