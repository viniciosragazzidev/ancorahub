/**
 * Mensagens com preço e mensagens fixas da venda. Determinísticas: os valores saem do snapshot da oferta,
 * nunca do modelo (§6 do plano). Texto sem travessão.
 */
import { AUTO_SALE_LIMITS, formatCents, type DealFacts, type OfferSnapshot, type Promotion } from "./contracts";
import { copartKind, savingsLine } from "./offer-strategy";
import { CONDITIONAL_DOCUMENTS, DUE_DAYS, STANDARD_DOCUMENTS } from "./playbook";

function livesLabel(count: number) {
  return count === 1 ? "1 pessoa" : `${count} pessoas`;
}

function copartLabel(plan: { coparticipation: string }) {
  const kind = copartKind(plan);
  return kind === "sem" ? "sem coparticipação" : kind === "parcial" ? "coparticipação parcial" : kind === "total" ? "com coparticipação" : plan.coparticipation || "coparticipação a confirmar";
}

export function planLine(plan: OfferSnapshot["plans"][number], index: number) {
  const accommodation = plan.accommodation ? `, ${plan.accommodation.toLocaleLowerCase("pt-BR")}` : "";
  return `${index + 1}. ${plan.operator} ${plan.name}: ${formatCents(plan.totalCents)} por mês (${copartLabel(plan)}${accommodation})`;
}

export function openingMessages(input: { brokerageName: string; facts: DealFacts }) {
  const name = input.facts.firstName ? `, ${input.facts.firstName}` : "";
  const known: string[] = [];
  if (input.facts.ages?.length) known.push(livesLabel(input.facts.ages.length));
  if (input.facts.city) known.push(`em ${input.facts.city}`);
  const summary = known.length ? `Vi que você procura um plano de saúde para ${known.join(" ")}. Está certo?` : "Vi que você procura um plano de saúde. Posso te ajudar a escolher?";
  return [`Oi${name}! Aqui é a assistente virtual da ${input.brokerageName}.`, summary];
}

export function quoteMessages(offer: OfferSnapshot) {
  const lives = offer.input.lives.length;
  const head = offer.relaxed
    ? `Achei ${offer.plans.length === 1 ? "uma opção mais em conta" : "opções mais em conta"} para ${livesLabel(lives)}: ${offer.relaxed.label}.`
    : `Separei ${offer.plans.length === 1 ? "uma opção" : `${offer.plans.length} opções`} para ${livesLabel(lives)} em ${offer.input.city}:`;
  const lines = offer.plans.map(planLine);
  const savings = offer.previousTotalCents != null && offer.plans[0] ? savingsLine(offer.previousTotalCents, offer.plans[0].totalCents) : null;
  const question = offer.plans.length > 1 ? `Qual chamou mais sua atenção: ${offer.plans.map((_, index) => index + 1).join(", ").replace(/, (\d)$/, " ou $1")}?` : "O que achou dessa opção?";
  return [head, lines.join("\n"), ...(savings ? [`São ${savings}.`] : []), question];
}

export function imageCaption(plan: OfferSnapshot["plans"][number], index: number, total: number) {
  return `${index + 1}. ${plan.operator} ${plan.name}: ${formatCents(plan.totalCents)} por mês.${total > 1 ? " Qual chamou mais sua atenção?" : ""}`;
}

export function pdfCaption() {
  return "Te mandei o PDF com as opções, a rede e o que precisa para contratar.";
}

export function documentsChecklist(facts: DealFacts) {
  const documents: string[] = [...STANDARD_DOCUMENTS];
  if ((facts.ages ?? []).some((age, index) => index > 0 && age < 18)) documents.push(CONDITIONAL_DOCUMENTS.child);
  if (facts.modality === "PME_EMPRESARIAL") documents.push(CONDITIONAL_DOCUMENTS.business);
  if (facts.currentPlan) documents.push(CONDITIONAL_DOCUMENTS.portability);
  if (facts.modality === "ADESAO") documents.push(CONDITIONAL_DOCUMENTS.adhesion);
  return documents;
}

export function documentsRequestMessages(facts: DealFacts) {
  return [
    "Perfeito! Para seguir, me manda por aqui:",
    documentsChecklist(facts).map((item) => `• ${item}`).join("\n"),
    `E qual o melhor dia de vencimento: ${DUE_DAYS.slice(0, -1).join(", ")} ou ${DUE_DAYS.at(-1)}?`,
  ];
}

export const HOLD_MESSAGE = "Vou confirmar isso e já te retorno.";
export const MISUNDERSTOOD_MESSAGE = "Não entendi direito. Pode me explicar de outro jeito?";
export const AUDIO_DECLINE_MESSAGE = "Não consegui ouvir seu áudio. Pode me mandar por escrito, por favor?";
export const OPT_OUT_MESSAGE = "Tudo bem, não vou mais te mandar mensagens. Se precisar, é só chamar aqui.";

export function activePromotionLines(promotions: readonly Promotion[]) {
  return promotions.map((promotion) => `${promotion.operator}: ${promotion.title} (até ${promotion.endsOn.split("-").reverse().join("/")})`);
}

/** Mensagem de follow-up (§10): cita o plano do snapshot, nunca o preço. */
export function followUpMessage(step: number, offer: OfferSnapshot | null, facts: DealFacts, promotions: readonly Promotion[]) {
  const name = facts.firstName ? `${facts.firstName}, ` : "";
  const recommended = offer?.plans.find((plan) => plan.id === offer.recommendedPlanId) ?? offer?.plans[0] ?? null;
  const [first, second] = offer?.plans ?? [];
  if (step === 0) return `${name}conseguiu olhar as opções? Se quiser, te explico a diferença entre elas.`;
  if (step === 1) {
    if (first && second) return `${name}ficou com o ${first.operator} ${first.name} ou com o ${second.operator} ${second.name}?`;
    // Sem preço no follow-up: a tabela pode ter mudado desde a cotação (o PDF tem os valores e a validade).
    if (recommended) return `${name}o ${recommended.operator} ${recommended.name} ainda faz sentido para você?`;
    return `${name}posso te ajudar a decidir?`;
  }
  if (step === 2) {
    const promotion = promotions.find((item) => !recommended || item.operator.toLocaleLowerCase("pt-BR") === recommended.operator.toLocaleLowerCase("pt-BR")) ?? null;
    if (promotion) return `${name}a condição "${promotion.title}" vale até ${promotion.endsOn.split("-").reverse().join("/")}. Quer garantir?`;
    return `${name}o que falta para você decidir? Posso te ajudar com alguma dúvida.`;
  }
  return `${name}se o valor pesou, posso procurar uma opção mais em conta. Se preferir deixar para depois, tudo bem também.`;
}

export const MAX_OPTIONS_IN_MESSAGE = AUTO_SALE_LIMITS.maxOptions;
