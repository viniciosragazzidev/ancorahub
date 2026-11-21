import lite from "@/features/next-best-action/components/next-best-action-card-lite.module.css";

import type { LeadJourney } from "../journey";
import { LeadJourneyView } from "./lead-journey-view";

/** Etapa do lead no topo da ficha (Lite): o mesmo cartão de borda fina da próxima ação. */
export function LeadJourneyCard({ journey }: { journey: LeadJourney }) {
  return (
    <section className={lite.card} aria-label="Etapa do lead" style={{ marginBottom: 16 }}>
      <p className="mb-ds-8 text-ds-caption font-medium uppercase tracking-wide text-ds-fog">Etapa do lead</p>
      <LeadJourneyView journey={journey} />
    </section>
  );
}
