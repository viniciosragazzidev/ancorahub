import { ChartLineUp, CheckIcon, Users, XCircle } from "@/components/huge-icons";

import { StatCard } from "@/components/dashboard/metric-card";
import type { BranchMetrics } from "@/features/branches/queries";

type UnitMetricsCardsProps = {
  metrics: BranchMetrics;
};

export function UnitMetricsCards({ metrics }: UnitMetricsCardsProps) {
  const conversionLabel =
    metrics.totalLeads === 0
      ? "Sem leads no período"
      : `${metrics.leadsConvertidos} de ${metrics.totalLeads} leads`;

  const lossLabel =
    metrics.totalLeads === 0
      ? "Sem leads no período"
      : `${metrics.leadsPerdidos} perdido${metrics.leadsPerdidos !== 1 ? "s" : ""} no período`;

  const totalLeads = Math.max(1, metrics.totalLeads);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Leads no período"
        value={metrics.totalLeads}
        sublabel={`Mês: ${metrics.period}`}
        icon={Users}
        sparklineData={metrics.leadsTrend}
        sparklineColor="var(--chart-1)"
        animated
      />
      <StatCard
        label="Taxa de conversão"
        value={`${metrics.taxaConversao}%`}
        sublabel={conversionLabel}
        icon={CheckIcon}
        valueClassName={
          metrics.taxaConversao >= 30
            ? "text-emerald-500"
            : metrics.taxaConversao >= 15
              ? "text-amber-500"
              : ""
        }
        sparklineData={metrics.leadsTrend.map((value) =>
          Math.round((value / totalLeads) * metrics.taxaConversao),
        )}
        sparklineColor="var(--chart-3)"
        animated
        animationDelay={0.06}
      />
      <StatCard
        label="Em atendimento"
        value={metrics.leadsAtivos}
        sublabel="Leads em andamento"
        icon={ChartLineUp}
        sparklineData={metrics.leadsTrend.map((value) =>
          Math.round((value / totalLeads) * metrics.leadsAtivos),
        )}
        sparklineColor="var(--chart-4)"
        animated
        animationDelay={0.12}
      />
      <StatCard
        label="Aguardando contato"
        value={metrics.leadsDistribuidos}
        sublabel={lossLabel}
        icon={XCircle}
        valueClassName={metrics.leadsDistribuidos > 0 ? "text-amber-500" : ""}
        sparklineData={metrics.leadsTrend.map((value) =>
          Math.round((value / totalLeads) * metrics.leadsDistribuidos),
        )}
        sparklineColor="var(--chart-2)"
        animated
        animationDelay={0.18}
      />
    </div>
  );
}
