"use client";

import { CheckCircle, Clock, CreditCard, CurrencyCircleDollar, Handshake } from "@/components/huge-icons";
import { StatCard } from "@/components/dashboard/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/features/quotes/utils";

export function SaleStatsCards({
  saleValue,
  totalCommissions,
  paidCommissions,
  pendingCommissions,
  paidPercentage,
  scheduleLength,
  paidCount,
  pendingCount,
}: {
  saleValue: string;
  totalCommissions: number;
  paidCommissions: number;
  pendingCommissions: number;
  paidPercentage: number;
  scheduleLength: number;
  paidCount: number;
  pendingCount: number;
}) {
  return (
    <>
      {/* Summary KPI Cards Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Valor da Venda"
          value={saleValue}
          icon={CreditCard}
          animated
        />
        <StatCard
          label="Total em Comissões"
          value={formatCurrency(totalCommissions)}
          icon={CurrencyCircleDollar}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          animated
          animationDelay={0.06}
        />
        <StatCard
          label="Comissão Paga"
          value={formatCurrency(paidCommissions)}
          icon={CheckCircle}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          valueClassName="text-emerald-600 dark:text-emerald-400"
          animated
          animationDelay={0.12}
        />
        <StatCard
          label="Comissão A Pagar"
          value={formatCurrency(pendingCommissions)}
          icon={Clock}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          valueClassName="text-amber-600 dark:text-amber-400"
          animated
          animationDelay={0.18}
        />
      </div>

      {/* Payout Completion Progress Indicator */}
      {totalCommissions > 0 && (
        <Card size="sm" className="border-border/60 bg-muted/20 shadow-xs">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Handshake className="size-4 text-primary" />
                Progresso do Repasse de Comissões
              </span>
              <span className="font-mono font-semibold text-primary">{paidPercentage}% Concluído</span>
            </div>
            <Progress value={paidPercentage} className="h-2 bg-muted" />
            <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground">
              <span>{paidCount} de {scheduleLength} parcelas liberadas</span>
              <span>{pendingCount} parcelas restantes</span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
