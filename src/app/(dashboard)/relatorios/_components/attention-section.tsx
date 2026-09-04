import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AttentionSnapshot } from "@/features/reports/metrics/metrics-service";
import type { PeriodValue } from "@/shared/period";
import { Warning, ArrowUpRight } from "@/components/huge-icons";

interface AttentionSectionProps {
  readonly attention: AttentionSnapshot;
  readonly period: PeriodValue;
}

export function AttentionSection({ attention, period }: AttentionSectionProps) {
  if (attention.items.length === 0) return null;

  return (
    <section aria-labelledby="attention-title">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Warning className="size-3.5" aria-hidden="true" />
        <h2 id="attention-title" className="font-medium text-foreground">O que exige atenção</h2>
        <span aria-hidden="true">•</span>
        <span>Período: {period} dias</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {attention.items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "group rounded-lg border border-border bg-card p-4 shadow-sm",
              "transition-colors hover:border-primary/30 hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              item.count === 0 && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-semibold tabular-nums tracking-tight">{item.count}</p>
                <p className="mt-1 text-sm font-medium">{item.title}</p>
              </div>
              <ArrowUpRight
                className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-5">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
