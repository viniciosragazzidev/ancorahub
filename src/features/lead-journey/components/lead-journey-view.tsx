import { CalendarClock } from "lucide-react";

import { DsStatusBadge } from "@/components/ui/ds-status-badge";
import { SegmentBar } from "@/components/ui/segment-bar";
import { cn } from "@/lib/utils";

import { journeyPhaseLabel, journeyTitle, type LeadJourney } from "../journey";

/**
 * Etapa do lead (plano de recuperação §8.1): a régua Qualificação → Corretor → Negociação, a etapa escrita
 * ("Em conversa · Idades") e o próximo passo. `compact` cabe numa célula de tabela; `full` vai no hover card,
 * na ficha e no drawer. Só lê o que `deriveLeadJourney` devolveu.
 */
export function LeadJourneyView({ journey, variant = "full", className }: { journey: LeadJourney; variant?: "compact" | "full"; className?: string }) {
  const title = journeyTitle(journey);
  const bar = (
    <SegmentBar
      value={journey.step}
      total={journey.total}
      label={`${title}: passo ${journey.step} de ${journey.total} (${journeyPhaseLabel(journey)})`}
    />
  );
  if (variant === "compact") {
    return (
      <div className={cn("flex min-w-36 flex-col gap-ds-4", className)} data-slot="lead-journey" data-code={journey.code}>
        <span className="truncate text-ds-body font-medium text-ds-charcoal">{title}</span>
        {bar}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-ds-8", className)} data-slot="lead-journey" data-code={journey.code}>
      <div className="flex min-w-0 items-center justify-between gap-ds-8">
        <span className="truncate text-ds-body font-medium text-ds-charcoal">{title}</span>
        <DsStatusBadge className="shrink-0" status={journey.tone} label={journeyPhaseLabel(journey)} />
      </div>
      <div className="flex items-center gap-ds-12">
        {bar}
        <span className="shrink-0 text-ds-caption text-ds-fog tabular-nums" aria-hidden>
          {journey.step} de {journey.total}
        </span>
      </div>
      {journey.reason ? <p className="text-ds-caption text-ds-fog">{journey.reason}</p> : null}
      {journey.nextStep ? (
        <p className="flex items-center gap-ds-8 text-ds-body text-ds-charcoal">
          <CalendarClock aria-hidden className="size-3.5 shrink-0 text-ds-fog" />
          <span className="min-w-0">{journey.nextStep}</span>
        </p>
      ) : null}
    </div>
  );
}
