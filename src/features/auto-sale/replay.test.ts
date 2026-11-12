/**
 * F5: suíte de replay da Venda Automatizada. Conversas anonimizadas, modeladas do estudo dos fechamentos
 * de 12/11 (sequência dos ganhadores, objeções, áudio transcrito, perdidas), rodadas pelo motor do turno
 * com um modelo roteirizado (sem rede). Cobre: chegar ao pedido de documentos nas que fecharam, nunca
 * deixar sair valor fora do snapshot, parar em opt-out e em "falar com uma pessoa", e as 10 objeções.
 */
import { describe, expect, it } from "vitest";

import type { QuoteResult } from "@/features/global-catalog/pilot/contracts";

import type { AutoSaleStage, DealFacts, OfferSnapshot } from "./contracts";
import { quoteInputFromFacts } from "./facts";
import { allowedMoneyFromOffers, extractMoneyCents } from "./guardrails";
import { pickCheaper, recommendationReason, selectOptions, toOfferPlan } from "./offer-strategy";
import { quoteMessages } from "./quote-messages";
import { planTurn, type AgentTurnDecision } from "./turn-engine";

function plan(id: string, operator: string, name: string, totalCents: number, coparticipation = "Sem coparticipação"): QuoteResult {
  return {
    id, name, code: id, operator, operatorId: operator, administrator: "", modality: "PESSOA_FISICA", accommodation: "Enfermaria", coparticipation,
    coverage: "Ambulatorial + Hospitalar", entity: "", dental: null, minAge: null, maxAge: null, holderMin: null, holderMax: null, dependentMin: null,
    dependentMax: null, minLives: null, maxLives: null, minHolders: null, ageConfirmed: true, eligibilityConfirmed: true, businessConfirmed: true,
    from: null, to: null, networkCount: 3, detailCount: 2, totalCents,
    perLife: [{ age: 34, holder: true, priceId: `${id}-1`, cents: Math.round(totalCents / 2), from: null, to: null }, { age: 31, holder: false, priceId: `${id}-2`, cents: totalCents - Math.round(totalCents / 2), from: null, to: null }],
    state: "ready", reasons: [],
  };
}

/** Catálogo de mentira com os ganhadores do estudo (nomes e preços fictícios). */
const CATALOG = [
  plan("klini200", "Klini", "200", 41980),
  plan("bronze", "Amil", "Bronze", 52340, "Coparticipação parcial"),
  plan("leve400", "Leve", "Top 400", 47710),
  plan("assim", "Assim", "Essencial", 35990, "Com coparticipação"),
  plan("premium", "Amil", "Ouro", 98000),
];

type Step = { customer: string; decision: Omit<AgentTurnDecision, "facts"> & { facts?: Partial<DealFacts> } | null };

function runReplay(steps: Step[], initialFacts: DealFacts = { firstName: "Cliente" }) {
  let stage: AutoSaleStage = "confirming";
  let facts = initialFacts;
  let misunderstood = 0;
  const offers: OfferSnapshot[] = [];
  const outgoing: string[] = [];
  const log: { stage: AutoSaleStage; action: string; manager: string | null; stop: string | null }[] = [];
  for (const step of steps) {
    const decision = step.decision ? { facts: {}, ...step.decision } as AgentTurnDecision : null;
    const result = planTurn({ stage, facts, misunderstoodCount: misunderstood, offers, hasActivePromotion: false, networkSourced: false }, [step.customer], decision);
    facts = result.facts;
    misunderstood = result.misunderstoodCount;
    const messages = [...result.messages];
    if (result.quote) {
      const input = quoteInputFromFacts(facts)!;
      expect(input).not.toBeNull();
      const previous = offers.at(-1) ?? null;
      const selected = result.quote === "new" ? selectOptions(CATALOG, facts, "copilot").plans : pickCheaper(CATALOG, previous!.plans[0].totalCents, "copilot").map(toOfferPlan);
      if (selected.length) {
        const snapshot: OfferSnapshot = {
          id: `offer-${offers.length + 1}`, version: offers.length + 1, input, plans: selected, recommendedPlanId: selected[0].id,
          recommendationReason: recommendationReason(selected[0], selected, facts), relaxed: result.quote === "cheaper" ? { filter: "coparticipation", label: "incluí planos com coparticipação" } : null,
          previousOfferId: previous?.id ?? null, previousTotalCents: previous?.plans[0]?.totalCents ?? null, release: "cotadorfm-2026-11-11-abcdefabcdef", catalogDate: "2026-11-12",
        };
        offers.push(snapshot);
        messages.push(...quoteMessages(snapshot));
      }
    }
    // Nenhum valor que sai pode estar fora do snapshot vigente (nem do que o cliente disse).
    const allowed = allowedMoneyFromOffers(offers, [facts.currentPriceCents, facts.budgetCents].filter((value): value is number => typeof value === "number"));
    for (const message of messages) {
      for (const value of extractMoneyCents(message)) {
        expect([...allowed].some((cents) => cents === value || Math.floor(cents / 100) * 100 === value || Math.round(cents / 100) * 100 === value), `valor ${value} fora do snapshot em "${message}"`).toBe(true);
      }
    }
    outgoing.push(...messages);
    stage = result.stage;
    log.push({ stage, action: result.action, manager: result.callManager, stop: result.stop });
    if (result.stop || result.callManager) break;
  }
  return { stage, facts, offers, outgoing, log };
}

const d = (nextAction: AgentTurnDecision["nextAction"], intent: AgentTurnDecision["intent"], messages: string[], extra: Partial<AgentTurnDecision> = {}): Step["decision"] => ({ nextAction, intent, messages, objection: null, managerReason: null, ...extra });

describe("replay: fechamentos chegam ao pedido de documentos", () => {
  it("casal PF: confirma, cota, afunila, recomenda, aceita e recebe a lista de documentos", () => {
    const run = runReplay([
      { customer: "isso mesmo, eu e minha esposa", decision: d("ask", "confirm", ["Perfeito! Vocês moram em qual bairro?"], { facts: { ages: [34, 31] } }) },
      { customer: "Icaraí, Niterói. sem coparticipação de preferência", decision: d("quote", "answer", ["Ótimo, já vou separar as opções."], { facts: { city: "Niterói", neighborhood: "Icaraí", modality: "PESSOA_FISICA", coparticipation: "sem" } }) },
      { customer: "gostei do 2, qual vc indica?", decision: d("recommend", "question", ["Eu indicaria o Klini 200: não tem coparticipação e cabe bem."]) },
      { customer: "fechado, vamos fazer", decision: d("request_documents", "accept", ["Que ótimo!"]) },
    ]);
    expect(run.stage).toBe("documents");
    expect(run.offers).toHaveLength(1);
    expect(run.outgoing.join("\n")).toMatch(/RG ou CNH/);
    expect(run.outgoing.join("\n")).toMatch(/vencimento: 1, 5, 10 ou 20/);
  });

  it("achou caro: a mais em conta sai de outra cotação, com a diferença, e fecha", () => {
    const run = runReplay([
      { customer: "somos 2, 34 e 31, Niterói, CPF", decision: d("quote", "answer", ["Vou separar as opções."], { facts: { ages: [34, 31], city: "Niterói", modality: "PESSOA_FISICA" } }) },
      { customer: "achei caro", decision: d("cheaper", "objection", ["Entendo, vou buscar uma mais em conta."], { objection: "expensive" }) },
      { customer: "esse dá, vamos seguir", decision: d("request_documents", "accept", ["Perfeito!"]) },
    ]);
    expect(run.offers).toHaveLength(2);
    expect(run.offers[1].plans[0].totalCents).toBeLessThan(run.offers[0].plans[0].totalCents);
    expect(run.stage).toBe("documents");
  });

  it("áudio transcrito vira texto e segue a mesma sequência", () => {
    const transcribed = "oi, é pra mim e pro meu marido, a gente tem 34 e 31 e mora em Niterói";
    const run = runReplay([
      { customer: transcribed, decision: d("quote", "answer", ["Obrigada! Já vou cotar."], { facts: { ages: [34, 31], city: "Niterói", modality: "PESSOA_FISICA" } }) },
      { customer: "o primeiro tá ótimo, pode mandar o que precisa", decision: d("request_documents", "accept", []) },
    ]);
    expect(run.stage).toBe("documents");
  });
});

describe("replay: nunca inventa número", () => {
  it("modelo tenta dar desconto sem número da cotação: barrado e chama o gestor", () => {
    const run = runReplay([
      { customer: "34 e 31, Niterói, CPF", decision: d("quote", "answer", ["Vou cotar."], { facts: { ages: [34, 31], city: "Niterói", modality: "PESSOA_FISICA" } }) },
      { customer: "faz por 300?", decision: d("handle_objection", "objection", ["Consigo fazer por R$ 300,00 para você!"], { objection: "expensive" }) },
    ]);
    expect(run.log.at(-1)?.manager).toBe("guard_blocked");
    expect(run.outgoing.join(" ")).not.toContain("300,00");
  });
  it("sem cotação, recomendação vira cotação: nada de preço antes do snapshot", () => {
    const run = runReplay([{ customer: "34, Niterói, CPF", decision: d("recommend", "answer", ["Recomendo o de R$ 199!"], { facts: { ages: [34], city: "Niterói", modality: "PESSOA_FISICA" } }) }]);
    expect(run.log[0].action).toBe("quote");
    expect(run.outgoing.join(" ")).not.toContain("199");
  });
  it("sem dados para cotar, pergunta (no máximo uma por vez) em vez de cotar", () => {
    const run = runReplay([{ customer: "quero saber o preço", decision: d("quote", "question", []) }]);
    expect(run.log[0].action).toBe("ask");
    expect(run.offers).toHaveLength(0);
    expect(run.outgoing).toHaveLength(1);
  });
});

describe("replay: paradas", () => {
  it("opt-out encerra na hora", () => {
    const run = runReplay([{ customer: "não tenho interesse", decision: d("ask", "reject", ["Tudo bem"]) }]);
    expect(run.log[0].stop).toBe("opt_out");
    expect(run.stage).toBe("lost");
  });
  it("pedir uma pessoa chama o gestor e segura a conversa uma vez", () => {
    const run = runReplay([{ customer: "quero falar com uma pessoa", decision: d("ask", "other", ["Claro"]) }]);
    expect(run.log[0].manager).toBe("asked_human");
    expect(run.outgoing).toEqual(["Vou confirmar isso e já te retorno."]);
  });
  it("duas mensagens sem entender chamam o gestor", () => {
    const run = runReplay([
      { customer: "asdf qwe", decision: d("ask", "unclear", []) },
      { customer: "zzz", decision: d("ask", "unclear", []) },
    ]);
    expect(run.log[1].manager).toBe("misunderstood");
  });
  it("modelo fora do ar: chama o gestor, nunca improvisa", () => {
    const run = runReplay([{ customer: "oi", decision: null }]);
    expect(run.log[0].manager).toBe("misunderstood");
  });
});

describe("replay: as 10 objeções", () => {
  const quoted = (customer: string, decision: Step["decision"]) => runReplay([
    { customer: "34 e 31, Niterói, CPF", decision: d("quote", "answer", ["Vou cotar."], { facts: { ages: [34, 31], city: "Niterói", modality: "PESSOA_FISICA" } }) },
    { customer, decision },
  ]);
  const cases: { key: NonNullable<AgentTurnDecision["objection"]>; customer: string; reply: string; manager?: string }[] = [
    { key: "expensive", customer: "tá caro", reply: "Entendo. Posso buscar uma opção mais em conta para você?" },
    { key: "pays_today", customer: "hoje pago R$ 600 na Unimed", reply: "Hoje você paga R$ 600, certo? Tem coparticipação no seu atual?" },
    { key: "hospital", customer: "tem o hospital Icaraí?", reply: "Vou confirmar na rede da operadora e já te retorno." },
    { key: "coparticipation", customer: "o que é coparticipação?", reply: "Na coparticipação você paga uma parte de consultas e exames. Sem ela, a mensalidade é maior e o uso não cobra." },
    { key: "waiting_period", customer: "e a carência?", reply: "Urgência e emergência em 24 horas, cirurgia eletiva em até 180 dias e parto em 300 dias, conforme o contrato." },
    { key: "spouse", customer: "vou falar com meu marido", reply: "Claro! Te retorno hoje à noite? Já deixo a lista de documentos com você." },
    { key: "ad_price", customer: "o anúncio dizia outro valor", reply: "O anúncio usa a tabela para MEI ou CNPJ. Você tem CNPJ aberto?" },
    { key: "age", customer: "minha filha de 17 pode entrar sozinha?", reply: "Essa regra é da operadora. Vou conferir e já te falo." },
    { key: "scam", customer: "isso é golpe?", reply: "Entendo a preocupação.", manager: "scam_suspicion" },
    { key: "think", customer: "vou pensar", reply: "Claro! O que falta para decidir? Ficou com o 1 ou o 2?" },
  ];
  for (const item of cases) {
    it(`${item.key}: responde no roteiro e sem número inventado`, () => {
      const run = quoted(item.customer, d("handle_objection", "objection", [item.reply], { objection: item.key, facts: item.key === "pays_today" ? { currentPriceCents: 60000 } : {} }));
      if (item.manager) expect(run.log.at(-1)?.manager).toBe(item.manager);
      else {
        expect(run.log.at(-1)?.manager).toBeNull();
        expect(run.stage).toBe("objections");
      }
    });
  }
});
