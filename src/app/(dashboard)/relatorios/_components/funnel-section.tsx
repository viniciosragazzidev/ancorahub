import { cn } from "@/lib/utils";
import type { FunnelSnapshot } from "@/features/reports/metrics/metrics-service";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { FunnelStage } from "@/features/reports/metrics/metrics-math";
import { TrendUp } from "@/components/huge-icons";

const STAGE_COLORS: Record<FunnelStage | "lost", string> = {
  new: "bg-sky-100 text-sky-700",
  distributed: "bg-indigo-100 text-indigo-700",
  in_contact: "bg-violet-100 text-violet-700",
  quote_sent: "bg-purple-100 text-purple-700",
  negotiation: "bg-fuchsia-100 text-fuchsia-700",
  documentation_pending: "bg-amber-100 text-amber-700",
  under_analysis: "bg-orange-100 text-orange-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
};

const MAX_BAR_WIDTH = 100;

interface FunnelSectionProps {
  readonly funnel: FunnelSnapshot;
}

export function FunnelSection({ funnel }: FunnelSectionProps) {
  const maxReached = Math.max(...funnel.rows.map((r) => r.reached), 1);

  return (
    <section aria-labelledby="funnel-title">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <TrendUp className="size-3.5" aria-hidden="true" />
        <h2 id="funnel-title" className="font-medium text-foreground">Funil de 8 estágios</h2>
        <span aria-hidden="true">•</span>
        <span>{funnel.received} leads recebidos</span>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="space-y-3">
          {funnel.rows.map((row) => {
            const barWidth = Math.round((row.reached / maxReached) * MAX_BAR_WIDTH);
            const label = LEAD_STATUS_LABELS[row.stage] ?? row.stage;
            return (
              <div key={row.stage} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm font-medium" title={label}>
                  {label}
                </span>
                <div className="relative h-6 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className={cn("absolute inset-y-0 left-0 rounded", STAGE_COLORS[row.stage])}
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium tabular-nums">
                    {row.reached}
                  </span>
                </div>
                {row.progressionToNext !== null && (
                  <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {row.progressionToNext.toFixed(0)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {funnel.lost > 0 && (
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
            <span className="w-40 shrink-0 truncate text-sm font-medium text-red-600">Perdidos</span>
            <span className="text-sm tabular-nums text-red-600">{funnel.lost}</span>
            <span className="text-xs text-muted-foreground">
              ({((funnel.lost / funnel.received) * 100).toFixed(1)}% do total)
            </span>
          </div>
        )}

        {funnel.biggestBottleneck !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Maior gargalo: <span className="font-medium text-foreground">
              {LEAD_STATUS_LABELS[funnel.biggestBottleneck] ?? funnel.biggestBottleneck}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
