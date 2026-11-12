/**
 * O que a página pública da cotação mostra (puro, testado). Mínimo de dado pessoal: primeiro nome e as
 * idades cotadas; nunca telefone, e-mail, sobrenome ou dado de saúde. Valores só do snapshot.
 */
import { formatCents, type DealFacts, type OfferSnapshot, type Promotion } from "./contracts";
import { copartKind, isReadyExceptDocuments } from "./offer-strategy";
import { brDate, offerValidUntil, type NetworkHighlight } from "./pdf";
import { DUE_DAYS } from "./playbook";
import { documentsChecklist } from "./quote-messages";

export type PublicQuoteView = {
  brokerageName: string;
  firstName: string | null;
  issuedAt: string;
  validUntil: string;
  profile: string;
  relaxedNote: string | null;
  savingsNote: string | null;
  pendingNote: string | null;
  plans: { id: string; operator: string; name: string; total: string; accommodation: string; coparticipation: string; perLife: string[]; recommended: boolean }[];
  recommendationReason: string | null;
  network: { title: string; units: string[] } | null;
  promotions: string[];
  documents: string[];
  nextStep: string;
  units: string[];
  whatsappUrl: string | null;
  legal: string;
};

function copartLabel(value: string) {
  const kind = copartKind({ coparticipation: value });
  return kind === "sem" ? "Sem coparticipação" : kind === "parcial" ? "Coparticipação parcial" : kind === "total" ? "Com coparticipação" : value || "Coparticipação a confirmar";
}

function modalityLabel(offer: OfferSnapshot) {
  if (offer.input.modality.startsWith("PME")) return "Empresarial (MEI ou CNPJ)";
  if (offer.input.modality.startsWith("ADESAO")) return offer.input.entity ? `Adesão (${offer.input.entity})` : "Adesão por entidade";
  return "Pessoa física";
}

/** Link do WhatsApp da corretora com a mensagem pronta; null sem número. */
export function whatsappLink(phone: string | null | undefined, text: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

export function buildPublicQuoteView(input: {
  offer: OfferSnapshot;
  facts: DealFacts;
  brokerage: { name: string; units: readonly string[]; whatsappPhone: string | null };
  promotions: readonly Promotion[];
  network: NetworkHighlight | null;
}): PublicQuoteView {
  const { offer } = input;
  const lives = offer.input.lives;
  const recommended = offer.plans.find((plan) => plan.id === offer.recommendedPlanId);
  const cheapest = offer.plans[0]?.totalCents;
  const networkPlan = input.network ? offer.plans.find((plan) => plan.id === input.network!.planId) : null;
  return {
    brokerageName: input.brokerage.name,
    firstName: input.facts.firstName ?? null,
    issuedAt: brDate(offer.catalogDate),
    validUntil: brDate(offerValidUntil(offer)),
    profile: `${lives.length === 1 ? "1 pessoa" : `${lives.length} pessoas`} (${lives.map((life) => `${life.age} anos`).join(", ")}) · ${offer.input.city} · ${modalityLabel(offer)}`,
    relaxedNote: offer.relaxed ? `Para baixar o valor, ${offer.relaxed.label}.` : null,
    savingsNote: offer.previousTotalCents != null && cheapest != null && offer.previousTotalCents > cheapest ? `${formatCents(offer.previousTotalCents - cheapest)} a menos por mês que a cotação anterior.` : null,
    pendingNote: offer.plans.some((plan) => !isReadyExceptDocuments(plan))
      ? "Valores da tabela da operadora; condições do produto em conferência pela corretora."
      : offer.plans.some((plan) => plan.state !== "ready") ? "Vínculo, entidade ou tempo de empresa são conferidos na documentação, como em toda contratação." : null,
    plans: offer.plans.map((plan) => ({
      id: plan.id,
      operator: plan.operator,
      name: plan.name,
      total: formatCents(plan.totalCents),
      accommodation: plan.accommodation || "Acomodação conforme contrato",
      coparticipation: copartLabel(plan.coparticipation),
      perLife: plan.perLife.map((life) => `${life.holder ? "Titular" : "Dependente"}, ${life.age} anos: ${formatCents(life.cents)}`),
      recommended: plan.id === recommended?.id,
    })),
    recommendationReason: offer.recommendationReason,
    network: input.network?.units.length ? {
      title: `Rede perto de você${networkPlan ? ` (${networkPlan.operator} ${networkPlan.name})` : ""}`,
      units: input.network.units.slice(0, 8).map((unit) => [unit.name, unit.type?.toLocaleLowerCase("pt-BR"), unit.neighborhood].filter(Boolean).join(", ")),
    } : null,
    promotions: input.promotions.map((promotion) => `${promotion.operator}: ${promotion.title}. ${promotion.description} Válida até ${brDate(promotion.endsOn)}.`),
    documents: documentsChecklist(input.facts),
    nextStep: `Responda SIM no WhatsApp e escolha o vencimento: ${DUE_DAYS.slice(0, -1).join(", ")} ou ${DUE_DAYS.at(-1)}.`,
    units: [...input.brokerage.units].slice(0, 4),
    whatsappUrl: whatsappLink(input.brokerage.whatsappPhone, recommended ? `Quero seguir com o ${recommended.operator} ${recommended.name}.` : "Quero seguir com a cotação."),
    legal: `Valores da tabela da operadora em ${brDate(offer.catalogDate)}, sujeitos à análise e aceitação da operadora. Esta cotação não é proposta nem contrato.`,
  };
}
