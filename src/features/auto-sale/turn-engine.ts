/**
 * O turno do agente (§6 a §8 do plano), puro: recebe a rajada do cliente e a decisão do modelo e devolve
 * o que fazer. O modelo decide a intenção e escreve o texto sem preço; preço só sai depois, das mensagens
 * determinísticas da oferta. Tudo que é parada ou chamada ao gestor é decidido aqui, antes do modelo.
 */
import { z } from "zod";

import { dealFactsSchema, MANAGER_CALL_REASONS, type AutoSaleStage, type DealFacts, type ManagerCallReason, type OfferSnapshot } from "./contracts";
import { mergeFacts, missingForQuote, plausibleCity, type MissingFact } from "./facts";
import { checkOutgoingMessages, classifyInbound, sanitizeMessage, type GuardViolation, allowedMoneyFromOffers, extractMoneyCents } from "./guardrails";
import { documentsRequestMessages, HOLD_MESSAGE, MISUNDERSTOOD_MESSAGE, OPT_OUT_MESSAGE } from "./quote-messages";
import { AGENT_ACTIONS, nextStage, requiresOffer, type AgentAction } from "./state-machine";

/**
 * Fatos que o modelo mandou: guarda só os campos válidos (null, texto fora do formato ou campo
 * desconhecido são descartados um a um), em vez de recusar a resposta inteira.
 */
export function cleanModelFacts(raw: unknown): Partial<DealFacts> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const shape = dealFactsSchema.shape as Record<string, z.ZodType<unknown>>;
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined || !(key in shape)) continue;
    const parsed = shape[key].safeParse(value);
    if (key === "city" && typeof value === "string" && !plausibleCity(value)) continue;
    if (key === "city" && typeof value === "string" && !plausibleCity(value)) continue;
    if (parsed.success && parsed.data !== undefined) clean[key] = parsed.data;
  }
  return clean as Partial<DealFacts>;
}

/**
 * Decisão do modelo (12/11: tolerante). Campo fora do formato vira o valor seguro em vez de derrubar o
 * turno: intenção "other", ação "ask", objeção e motivo nulos, mensagens cortadas em 4 de até 600 caracteres.
 */
// Sem transform no formato: ele vira o json_schema que o Claude recebe (tipos claros); a limpeza é depois.
export const agentTurnSchema = z.object({
  intent: z.enum(["confirm", "answer", "question", "objection", "accept", "reject", "documents", "unclear", "small_talk", "other"]).catch("other"),
  facts: z.record(z.string(), z.unknown()).catch({}),
  objection: z.enum(["expensive", "pays_today", "hospital", "coparticipation", "waiting_period", "spouse", "ad_price", "age", "scam", "think", "other"]).nullable().catch(null),
  nextAction: z.enum(AGENT_ACTIONS).catch("ask"),
  messages: z.array(z.string()).catch([]),
  managerReason: z.enum(Object.keys(MANAGER_CALL_REASONS) as [ManagerCallReason, ...ManagerCallReason[]]).nullable().catch(null),
});
export type AgentTurnDecision = Omit<z.infer<typeof agentTurnSchema>, "facts"> & { facts: Partial<DealFacts> };

/** Resposta validada do modelo para a decisão do turno: só fatos válidos, até 4 mensagens de até 600 caracteres. */
export function normalizeDecision(raw: z.infer<typeof agentTurnSchema>): AgentTurnDecision {
  return {
    ...raw,
    facts: cleanModelFacts(raw.facts),
    messages: raw.messages.filter((message) => message.trim().length > 0).slice(0, 4).map((message) => message.slice(0, 600)),
  };
}

export const QUESTION_FOR: Record<MissingFact, string> = {
  ages: "Para eu cotar certinho: qual a idade de cada pessoa que vai entrar no plano?",
  city: "E em qual cidade e bairro vocês moram?",
  modality: "Você tem CNPJ ou MEI aberto, ou seria no seu CPF? Se for por profissão (OAB, CREA, conselho), me conta também.",
  entity: "Qual a sua profissão ou a entidade de classe? Por exemplo OAB, CREA ou CRM.",
  businessProfile: "Sua empresa é MEI, ME, EPP ou LTDA?",
  businessMonths: "Há quanto tempo o CNPJ está aberto?",
};

/** Adesão: pergunta a entidade, mostrando até 3 do catálogo quando o que o cliente disse bate com várias. */
export function entityQuestion(options: readonly string[]) {
  if (!options.length) return QUESTION_FOR.entity;
  const list = options.slice(0, 3);
  return `Por qual entidade seria: ${list.length > 1 ? `${list.slice(0, -1).join(", ")} ou ${list.at(-1)}` : list[0]}?`;
}

export type TurnState = {
  stage: AutoSaleStage;
  facts: DealFacts;
  misunderstoodCount: number;
  offers: readonly OfferSnapshot[];
  hasActivePromotion: boolean;
  networkSourced: boolean;
};

export type TurnPlan = {
  stop: "opt_out" | null;
  callManager: ManagerCallReason | null;
  injection: boolean;
  facts: DealFacts;
  action: AgentAction;
  /** O servidor cota (nova) ou procura a mais em conta, grava o snapshot e manda as mensagens de preço. */
  quote: "new" | "cheaper" | null;
  messages: string[];
  stage: AutoSaleStage;
  misunderstoodCount: number;
  violations: GuardViolation[];
  intent: string | null;
  objection: string | null;
};

function customerMoney(facts: DealFacts) {
  return [facts.currentPriceCents, facts.budgetCents].filter((value): value is number => typeof value === "number");
}

export function planTurn(state: TurnState, inbound: readonly string[], decision: AgentTurnDecision | null): TurnPlan {
  const signal = inbound.map((text) => classifyInbound(text)).reduce(
    (acc, item) => ({ stop: acc.stop ?? item.stop, callManager: acc.callManager ?? item.callManager, injection: acc.injection || item.injection }),
    { stop: null, callManager: null, injection: false } as ReturnType<typeof classifyInbound>,
  );
  const base = { injection: signal.injection, intent: decision?.intent ?? null, objection: decision?.objection ?? null, violations: [] as GuardViolation[] };

  // 1. Parada imediata: opt-out encerra; o resto chama o gestor e segura a conversa uma vez.
  if (signal.stop) {
    return { ...base, stop: "opt_out", callManager: null, facts: state.facts, action: "end", quote: null, messages: [OPT_OUT_MESSAGE], stage: "lost", misunderstoodCount: state.misunderstoodCount };
  }
  if (signal.callManager) return callManager(state, signal.callManager, base);
  if (!decision) return callManager(state, "misunderstood", base);

  const facts = mergeFacts(state.facts, decision.facts);
  if (decision.intent === "documents") return callManager({ ...state, facts }, "documents_received", base);
  if (decision.nextAction === "call_manager") return callManager({ ...state, facts }, decision.managerReason ?? "objection_off_script", base);

  // 2. Não entendeu: pede de outro jeito; na segunda vez seguida chama o gestor.
  if (decision.intent === "unclear") {
    const count = state.misunderstoodCount + 1;
    if (count >= 2) return callManager({ ...state, facts }, "misunderstood", base, count);
    return { ...base, stop: null, callManager: null, facts, action: "ask", quote: null, messages: [MISUNDERSTOOD_MESSAGE], stage: state.stage, misunderstoodCount: count };
  }

  // 3. Ação: sem oferta, nada de recomendação ou fechamento (vira cotação); sem dados, vira pergunta.
  let action: AgentAction = decision.nextAction;
  if (requiresOffer(action) && !state.offers.length) action = "quote";
  const missing = missingForQuote(facts);
  if ((action === "quote" || action === "cheaper") && missing.length) action = "ask";

  // 4. Guardrails no texto do modelo: preço só do snapshot vigente; promoção, rede e promessas com fonte.
  const draft = decision.messages.map(sanitizeMessage).filter(Boolean).slice(0, 4);
  const context = { allowedMoney: allowedMoneyFromOffers(state.offers, customerMoney(facts)), hasActivePromotion: state.hasActivePromotion, networkSourced: state.networkSourced };
  // Antes da cotação, mensagem de introdução com valor é descartada (os preços saem da oferta).
  const leadIn = action === "quote" || action === "cheaper" ? draft.filter((message) => !extractMoneyCents(message).length).slice(0, 1) : draft;
  const violations = leadIn.length ? checkOutgoingMessages(leadIn, context).filter((violation) => violation.rule !== "empty") : [];
  if (violations.length) return callManager({ ...state, facts }, "guard_blocked", { ...base, violations });

  let messages = leadIn;
  if (action === "ask" && missing.length && !messages.some((message) => message.includes("?"))) messages = [...messages, QUESTION_FOR[missing[0]]];
  if (action === "request_documents") messages = [...messages.slice(0, 1), ...documentsRequestMessages(facts)];
  if (!messages.length && action !== "quote" && action !== "cheaper") messages = action === "ask" && missing.length ? [QUESTION_FOR[missing[0]]] : [];

  return {
    ...base,
    stop: null,
    callManager: null,
    facts,
    action,
    quote: action === "quote" ? "new" : action === "cheaper" ? "cheaper" : null,
    messages,
    stage: nextStage(state.stage, action),
    misunderstoodCount: 0,
  };
}

function callManager(state: TurnState, reason: ManagerCallReason, base: Pick<TurnPlan, "injection" | "intent" | "objection" | "violations">, misunderstoodCount = state.misunderstoodCount): TurnPlan {
  return {
    ...base,
    stop: null,
    callManager: reason,
    facts: state.facts,
    action: "call_manager",
    quote: null,
    messages: [HOLD_MESSAGE],
    stage: nextStage(state.stage, "call_manager"),
    misunderstoodCount,
  };
}

/** Contexto que o modelo recebe (dados, não instruções). Minimiza dado pessoal: só o primeiro nome. */
export function buildTurnContext(input: { facts: DealFacts; stage: AutoSaleStage; offers: readonly OfferSnapshot[]; promotions: readonly string[]; history: readonly { direction: "in" | "out"; body: string }[]; inbound: readonly string[] }) {
  const current = input.offers.at(-1);
  return JSON.stringify({
    etapa: input.stage,
    fatos: input.facts,
    faltaParaCotar: missingForQuote(input.facts),
    ofertaVigente: current ? {
      opcoes: current.plans.map((plan, index) => ({ numero: index + 1, id: plan.id, operadora: plan.operator, plano: plan.name, acomodacao: plan.accommodation, coparticipacao: plan.coparticipation, totalCentavos: plan.totalCents })),
      recomendada: current.recommendedPlanId,
      motivo: current.recommendationReason,
    } : null,
    promocoesVigentes: input.promotions,
    historico: input.history.slice(-12).map((turn) => `${turn.direction === "in" ? "Cliente" : "Você"}: ${turn.body}`),
    mensagensNovasDoCliente: input.inbound,
  });
}
