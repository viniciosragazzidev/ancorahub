import { notFound } from "next/navigation";

import { buildPublicQuoteView } from "@/features/auto-sale/public-quote-view";
import { offerFrom, result } from "@/features/auto-sale/test-fixtures";

import { PublicQuotePage } from "../../compartilhado/cotacao/_components/public-quote-page";

/** Prévia de desenvolvimento da página pública da cotação, com dados fictícios e sem banco. */
export default function PublicQuotePreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const offer = offerFrom([
    result("assim", 71980, { operator: "Assim", name: "Essencial", coparticipation: "Coparticipação parcial", perLife: [{ age: 34, holder: true, priceId: "a1", cents: 35990, from: null, to: null }, { age: 31, holder: false, priceId: "a2", cents: 35990, from: null, to: null }] }),
    result("klini", 83960, { operator: "Klini", name: "200", perLife: [{ age: 34, holder: true, priceId: "k1", cents: 41980, from: null, to: null }, { age: 31, holder: false, priceId: "k2", cents: 41980, from: null, to: null }] }),
    result("leve", 95420, { operator: "Leve", name: "Top 400", state: "pending", perLife: [{ age: 34, holder: true, priceId: "l1", cents: 47710, from: null, to: null }, { age: 31, holder: false, priceId: "l2", cents: 47710, from: null, to: null }] }),
  ], {
    recommendedPlanId: "klini",
    recommendationReason: "Eu indicaria o Klini 200 porque não tem coparticipação e cabe no seu orçamento.",
    input: { modality: "PESSOA_FISICA", city: "Niterói", lives: [{ age: 34, holder: true, relationship: "Titular" }, { age: 31, holder: false, relationship: "Dependente" }], operator: "", administrator: "", profession: "", entity: "", businessProfile: "", businessMonths: null, accommodation: "", coparticipation: "", coverage: "", dental: "", query: "", budgetCents: null, includeIncompatible: false, page: 1 },
  });
  const view = buildPublicQuoteView({
    offer,
    facts: { firstName: "Joana", ages: [34, 31], city: "Niterói", neighborhood: "Icaraí" },
    brokerage: { name: "Âncora Saúde", units: ["Niterói Centro", "Rio Centro"], whatsappPhone: "21900000000" },
    promotions: [],
    network: { planId: "klini", units: [{ name: "Hospital Exemplo", type: "Hospital", neighborhood: "Icaraí" }, { name: "Laboratório Exemplo", type: "Laboratório", neighborhood: "Centro" }] },
  });
  return <PublicQuotePage view={view} pdfHref="#" />;
}
