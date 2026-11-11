import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { buildGuideFacets } from "@/features/global-catalog/pilot/guide/guide-facets";
import { loadPilotIndex, readPilotConfig } from "@/features/global-catalog/pilot/server";

import { CotadorPreview } from "./preview";

/** Dev-only: a Cotação guiada com o catálogo real do piloto, sem login de corretor. /dev/cotador */
export default async function CotadorPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const config = await readPilotConfig();
  if (!config) return <p>Catálogo do piloto não configurado.</p>;
  const index = await loadPilotIndex(config);
  const plans = index.plans.filter((plan) => !config.hiddenPlanIds.includes(plan.id));
  return <CotadorPreview facets={buildGuideFacets(plans, index.options, index.sourceDate)} />;
}
