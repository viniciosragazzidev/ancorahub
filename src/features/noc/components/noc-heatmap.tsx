"use client";

import React from "react";
import Link from "next/link";
import { Buildings, Users, Clock, WarningCircle, CircleCheckIcon } from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BranchHealth } from "@/features/noc/queries";

export function NocHeatmap({ branches }: { branches: BranchHealth[] }) {
  if (branches.length === 0) {
    return null;
  }

  const healthyCount = branches.filter((b) => b.health === "healthy").length;
  const attentionCount = branches.filter((b) => b.health === "attention").length;
  const criticalCount = branches.filter((b) => b.health === "critical").length;

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Buildings className="size-5 text-primary" />
              <CardTitle className="text-base font-semibold">Heatmap de Operação por Unidade</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Monitoramento em tempo real do estado operacional e gargalos das filiais.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-700 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              {healthyCount} Saudáveis
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-700 dark:text-amber-400">
              <span className="size-2 rounded-full bg-amber-500" />
              {attentionCount} Atenção
            </span>
            {criticalCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-medium text-red-700 dark:text-red-400">
                <span className="size-2 rounded-full bg-red-500 animate-ping" />
                {criticalCount} Críticas
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => {
            const isHealthy = branch.health === "healthy";
            const isAttention = branch.health === "attention";
            const isCritical = branch.health === "critical";

            const borderStyle = isCritical
              ? "border-red-500/50 bg-red-500/5 dark:bg-red-950/10"
              : isAttention
              ? "border-amber-500/50 bg-amber-500/5 dark:bg-amber-950/10"
              : "border-border/80 hover:border-primary/40 bg-card";

            const brokerCapacity =
              branch.totalBrokers > 0
                ? Math.round((branch.availableBrokers / branch.totalBrokers) * 100)
                : 0;

            return (
              <div
                key={branch.id}
                className={`flex flex-col justify-between rounded-xl border p-4 shadow-2xs transition-all ${borderStyle}`}
              >
                <div>
                  {/* Header of Branch Card */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {branch.name}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        {branch.healthReason}
                      </p>
                    </div>

                    <Badge
                      variant={isHealthy ? "success" : isAttention ? "warning" : "destructive"}
                      className="shrink-0 text-[10px] px-2 py-0.5 capitalize font-medium"
                    >
                      {isHealthy ? "Saudável" : isAttention ? "Atenção" : "Crítico"}
                    </Badge>
                  </div>

                  {/* Metrics grid for this branch */}
                  <div className="grid grid-cols-2 gap-2 my-3 rounded-lg bg-muted/40 p-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-medium">Leads Hoje</span>
                      <p className="font-mono font-bold text-sm text-foreground">{branch.leadsToday}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-medium">Atendimentos</span>
                      <p className="font-mono font-bold text-sm text-foreground">{branch.activeAttendances}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-medium">Sem Corretor</span>
                      <p className={`font-mono font-bold text-sm ${branch.unassignedLeads > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                        {branch.unassignedLeads}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase font-medium">Risco SLA</span>
                      <p className={`font-mono font-bold text-sm ${branch.slaRiskLeads > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                        {branch.slaRiskLeads}
                      </p>
                    </div>
                  </div>

                  {/* Broker Capacity */}
                  <div className="space-y-1 mt-3">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="size-3 text-muted-foreground" /> Corretores Online
                      </span>
                      <span className="font-mono font-medium">
                        {branch.availableBrokers} de {branch.totalBrokers}
                      </span>
                    </div>
                    <Progress value={brokerCapacity} className="h-1.5 bg-muted" />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {branch.acceptingLeads ? "Recepção Ativa" : "Recepção Pausada"}
                  </span>
                  <Button size="sm" variant="ghost" render={<Link href={`/unidades/${branch.id}`} />} className="h-7 text-xs px-2.5">
                    Detalhes →
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
