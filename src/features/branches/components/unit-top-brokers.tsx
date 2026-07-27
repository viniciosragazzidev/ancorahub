import { Users } from "@/components/huge-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { BranchTopBroker } from "@/features/branches/queries";

type UnitTopBrokersProps = {
  topBrokers: BranchTopBroker[];
  period: string;
};

function SparkBar({ value, max }: { value: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}%`}
    >
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function UnitTopBrokers({ topBrokers, period }: UnitTopBrokersProps) {
  const maxRate = Math.max(...topBrokers.map((b) => b.conversionRate), 1);

  if (topBrokers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
        <Users className="h-8 w-8 opacity-30" aria-hidden="true" />
        <p className="text-sm">Sem dados de conversão no período {period}.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Top corretores · {period}</p>
        <Button
          render={<Link href="/equipe" />}
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
        >
          Ver equipe completa
        </Button>
      </div>

      <ol className="flex flex-col gap-3" aria-label="Ranking de corretores por conversão">
        {topBrokers.map((broker, idx) => (
          <li key={broker.userId} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
                  aria-hidden="true"
                >
                  {idx + 1}
                </span>
                <p className="truncate text-sm font-medium">{broker.name}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {broker.converted}/{broker.totalLeads}
                </span>
                <span className="w-10 text-right font-mono text-sm font-semibold tabular-nums text-emerald-500">
                  {broker.conversionRate}%
                </span>
              </div>
            </div>
            <SparkBar value={broker.conversionRate} max={maxRate} />
          </li>
        ))}
      </ol>
    </div>
  );
}
