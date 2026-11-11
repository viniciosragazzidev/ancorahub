"use client";

import { useMemo } from "react";

import { getCatalogNetworkAction, getCatalogPlanAction, simulateCatalogAction } from "../actions";
import { exportCatalogProposalAction } from "../proposal-action";
import { CatalogQuoteGuide } from "./catalog-quote-guide";
import type { GuideFacets } from "./guide-flow";
import type { NetworkPage, QuoteGuideServices } from "./plan-sheets";

/** /cotacao: a cotação guiada ligada às ações do piloto (as mesmas checagens de acesso e auditoria). */
export function CatalogQuotePage({ facets, canExport }: { facets: GuideFacets; canExport: boolean }) {
  const services = useMemo<QuoteGuideServices>(() => ({
    simulate: simulateCatalogAction,
    plan: getCatalogPlanAction,
    network: async (input) => {
      const result = await getCatalogNetworkAction(input);
      return { data: result.data as NetworkPage | undefined, error: result.error };
    },
    exportPdf: exportCatalogProposalAction,
  }), []);
  return <CatalogQuoteGuide facets={facets} services={services} canExport={canExport} />;
}
