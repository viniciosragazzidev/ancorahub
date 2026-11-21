import { cn } from "@/lib/utils";

import type { TimelineItem, TimelineKind } from "../timeline";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Uma cor por tipo de item, com o ponto só (o texto segue Charcoal). */
const DOT: Record<TimelineKind, string> = {
  ai: "bg-ds-electric-blue",
  customer: "bg-ds-forest-ink",
  touch: "bg-ds-amber-ink",
  data: "bg-ds-steel",
  stage: "bg-ds-fog",
  alert: "bg-ds-rose-ink",
};

/** Linha do tempo da qualificação no drawer: hora, quem, o que e o resultado; mais recente em cima. */
export function QualificationTimeline({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <p className="text-ds-body text-ds-fog">Nada registrado ainda para este lead.</p>;
  return (
    <ol className="flex flex-col" aria-label="Linha do tempo da qualificação">
      {items.map((item) => (
        <li key={item.id} className="flex gap-ds-12 border-t border-ds-ash py-ds-8 first:border-t-0">
          <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-ds-tags", DOT[item.kind])} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-ds-8 text-ds-body">
              <span className="font-medium text-ds-charcoal">{item.title}</span>
              {item.channel ? <span className="text-ds-caption text-ds-fog">{item.channel}</span> : null}
              <time className="ml-auto font-ds-mono text-ds-caption text-ds-fog tabular-nums" dateTime={item.at}>{dateTime.format(new Date(item.at))}</time>
            </p>
            {item.detail ? <p className="mt-0.5 text-ds-body text-ds-steel">{item.detail}</p> : null}
            {item.outcome ? (
              <p className={cn("mt-0.5 text-ds-caption", item.outcome.startsWith("Falhou") ? "text-ds-rose-ink" : "text-ds-fog")}>{item.outcome}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
