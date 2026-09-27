import { StatCard } from "@/components/dashboard/metric-card";

type Metrics = {
  totalBranches: number;
  acceptingBranches: number;
  autoDistributeBranches: number;
  totalBrokers: number;
  totalAvailable: number;
  totalNewLeads: number;
};

/** Operation KPIs — the same StatCard grid as /equipe. */
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
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Filiais"
        value={metrics.totalBranches}
        sublabel={`${metrics.acceptingBranches} aceitando leads`}
      />
      <StatCard
        label="Recebendo leads"
        value={`${metrics.acceptingBranches}/${metrics.totalBranches}`}
        sublabel={`${acceptingRate}% das filiais`}
      />
      <StatCard
        label="Distribuição automática"
        value={`${metrics.autoDistributeBranches}/${metrics.totalBranches}`}
        sublabel={`${autoRate}% das filiais`}
      />
      <StatCard
        label="Corretores disponíveis"
        value={metrics.totalAvailable}
        sublabel={`${metrics.totalBrokers} corretores vinculados`}
      />
      <StatCard
        label="Leads novos"
        value={metrics.totalNewLeads}
        sublabel="aguardando primeiro contato"
        valueClassName={metrics.totalNewLeads > 0 ? "text-warning" : undefined}
      />
    </div>
  );
}
