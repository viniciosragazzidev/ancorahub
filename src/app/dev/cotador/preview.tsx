"use client";

import { useMemo } from "react";

import { CatalogQuoteGuide } from "@/features/global-catalog/pilot/guide/catalog-quote-guide";
import type { GuideFacets } from "@/features/global-catalog/pilot/guide/guide-flow";
import type { NetworkPage, QuoteGuideServices } from "@/features/global-catalog/pilot/guide/plan-sheets";

import { devNetwork, devPlan, devSimulate } from "./actions";

export function CotadorPreview({ facets }: { facets: GuideFacets }) {
  const services = useMemo<QuoteGuideServices>(() => ({
    simulate: devSimulate,
    plan: devPlan,
    network: async (input) => { const result = await devNetwork(input); return { data: result.data as NetworkPage | undefined, error: result.error }; },
    exportPdf: async () => ({ error: "No preview a proposta não é gerada." }),
  }), []);
  return <CatalogQuoteGuide facets={facets} services={services} />;
}
