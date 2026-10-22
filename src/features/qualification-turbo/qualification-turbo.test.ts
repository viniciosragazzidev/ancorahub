import { describe, expect, it } from "vitest";

import { APPROACHES, isNightInSaoPaulo, qualificationTemplateVariables, requestedOperator, resolveApproach } from "./approaches";
import { CADENCE, decideNextTouch, type CadenceInput, type TurboState } from "./cadence";
import { assignVariant, MIN_SENDS_BEFORE_LEARNING, replyRate, stableHash } from "./experiments";
import { RECOMMENDED_TEMPLATES, templateVariableOrder, toMetaTemplatePayload } from "./templates-pack";

/** 2026-10-21 is a Wednesday; São Paulo is UTC-3. */
const sp = (hour: number, minute = 0, day = 21) => new Date(Date.UTC(2026, 9, day, hour + 3, minute));

describe("abordagem por anúncio", () => {
  it("anúncio de clique para WhatsApp abre conversa grátis, sem template", () => {
    expect(resolveApproach({ externalId: "ctwa:wamid.1" }).id).toBe("ctwa");
    expect(resolveApproach({ sourceMetadata: { ctwaClid: "abc" } }).id).toBe("ctwa");
  });

  it("empresa pelo tipo PJ, pela resposta de CNPJ ou pela campanha", () => {
    expect(resolveApproach({ tipo: "PJ" }).id).toBe("pme");
    expect(resolveApproach({ sourceMetadata: { tipoCnpj: "MEI" } }).id).toBe("pme");
    expect(resolveApproach({ sourceMetadata: { campaignName: "[PME] Rio outubro" } }).id).toBe("pme");
    expect(resolveApproach({ sourceCampaign: "Plano empresarial Niterói" }).id).toBe("pme");
  });

  it("operadora pedida no formulário ou no nome da campanha", () => {
    expect(requestedOperator({ sourceMetadata: { operadora: "Amil" } })).toBe("Amil");
    expect(requestedOperator({ sourceMetadata: { campaignName: "[AMIL] Família RJ" } })).toBe("Amil");
    expect(resolveApproach({ sourceMetadata: { campaignName: "Campanha SulAmérica" } }).id).toBe("operadora");
  });

  it("sem pista, a abordagem direta para individual e família", () => {
    expect(resolveApproach({ sourceMetadata: { campaignName: "Plano familia Duque de Caxias" } }).id).toBe("direta");
    expect(APPROACHES.direta.firstContactTemplates.length).toBeGreaterThan(1);
  });

  it("madrugada vai das 22h às 7h em São Paulo", () => {
    expect(isNightInSaoPaulo(sp(23))).toBe(true);
    expect(isNightInSaoPaulo(sp(6, 59))).toBe(true);
    expect(isNightInSaoPaulo(sp(7))).toBe(false);
  });
});

describe("teste A/B do primeiro contato", () => {
  const variants = ["anc_t0_direta", "anc_t0_canal", "anc_t0_assistente"];

  it("o mesmo lead recebe sempre a mesma variante", () => {
    const first = assignVariant({ leadId: "lead-1", experiment: "t0:direta", variants });
    for (let i = 0; i < 5; i += 1) expect(assignVariant({ leadId: "lead-1", experiment: "t0:direta", variants })).toBe(first);
  });

  it("sem amostra mínima divide por igual", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i += 1) {
      const variant = assignVariant({ leadId: `lead-${i}`, experiment: "t0:direta", variants })!;
      counts.set(variant, (counts.get(variant) ?? 0) + 1);
    }
    for (const variant of variants) expect(counts.get(variant)! / 3000).toBeGreaterThan(0.28);
  });

  it("depois da amostra mínima, favorece a variante com mais respostas", () => {
    const stats = [
      { variant: "anc_t0_direta", sent: 400, replied: 160 },
      { variant: "anc_t0_canal", sent: 400, replied: 80 },
      { variant: "anc_t0_assistente", sent: 400, replied: 84 },
    ];
    let winner = 0;
    for (let i = 0; i < 1000; i += 1) if (assignVariant({ leadId: `lead-${i}`, experiment: "t0:direta", variants, stats }) === "anc_t0_direta") winner += 1;
    expect(winner / 1000).toBeGreaterThan(0.85);
  });

  it("não aprende antes de toda variante ter a amostra mínima", () => {
    const stats = [
      { variant: "anc_t0_direta", sent: MIN_SENDS_BEFORE_LEARNING - 1, replied: 49 },
      { variant: "anc_t0_canal", sent: 400, replied: 0 },
      { variant: "anc_t0_assistente", sent: 400, replied: 0 },
    ];
    const lead = "lead-x";
    expect(assignVariant({ leadId: lead, experiment: "t0:direta", variants, stats }))
      .toBe(variants[stableHash(`t0:direta:${lead}`) % variants.length]);
  });

  it("taxa de resposta com intervalo de confiança", () => {
    const { rate, low, high } = replyRate(200, 60);
    expect(rate).toBeCloseTo(0.3);
    expect(low).toBeLessThan(0.3);
    expect(high).toBeGreaterThan(0.3);
    expect(replyRate(0, 0).rate).toBe(0);
  });
});

describe("cadência de lembretes", () => {
  const allApproved = new Set(CADENCE.map((step) => step.template));
  const base = (firstAt: Date, extra: Partial<TurboState> = {}): CadenceInput => ({
    state: { approach: "direta", variant: "anc_t0_direta", firstContactAt: firstAt.toISOString(), touches: [{ touch: "t0", template: "anc_t0_direta", at: firstAt.toISOString(), status: "sent" }], ...extra },
    now: firstAt,
    lastInboundAt: null,
    optedOut: false,
    humanActive: false,
    assignedToBroker: false,
    closed: false,
    approvedTemplates: allApproved,
  });

  it("manda o lembrete 20 min depois do primeiro contato", () => {
    const input = base(sp(10));
    expect(decideNextTouch({ ...input, now: sp(10, 19) }).action).toBe("wait");
    const decision = decideNextTouch({ ...input, now: sp(10, 20) });
    expect(decision).toMatchObject({ action: "send", step: { touch: "t1" } });
  });

  it("para quando o lead responde, pede para parar ou vai para um corretor", () => {
    const input = base(sp(10));
    expect(decideNextTouch({ ...input, now: sp(11), lastInboundAt: sp(10, 5) })).toEqual({ action: "stop", reason: "replied" });
    expect(decideNextTouch({ ...input, now: sp(11), optedOut: true })).toEqual({ action: "stop", reason: "opt_out" });
    expect(decideNextTouch({ ...input, now: sp(11), assignedToBroker: true })).toEqual({ action: "stop", reason: "assigned" });
  });

  it("não manda marketing de madrugada: o T2 espera as 8h", () => {
    const first = sp(21);
    const input = base(first, { touches: [
      { touch: "t0", template: "anc_t0_direta", at: first.toISOString(), status: "sent" },
      { touch: "t1", template: "anc_t1_lembrete", at: sp(21, 20).toISOString(), status: "sent" },
    ] });
    expect(decideNextTouch({ ...input, now: new Date(first.getTime() + 4 * 3600_000) }).action).toBe("wait");
    expect(decideNextTouch({ ...input, now: sp(8, 0, 22) })).toMatchObject({ action: "send", step: { touch: "t2" } });
  });

  it("espera 90 min entre dois lembretes", () => {
    const first = sp(5);
    const input = base(first, { touches: [
      { touch: "t0", template: "anc_t0_direta", at: first.toISOString(), status: "sent" },
      { touch: "t1", template: "anc_t1_lembrete", at: sp(8).toISOString(), status: "sent" },
    ] });
    expect(decideNextTouch({ ...input, now: sp(8, 30) }).action).toBe("wait");
    expect(decideNextTouch({ ...input, now: sp(9, 31) })).toMatchObject({ action: "send", step: { touch: "t2" } });
  });

  it("pula o toque cujo template ainda não foi aprovado", () => {
    const input = { ...base(sp(10)), now: sp(10, 25), approvedTemplates: new Set(["anc_t2_beneficio"]) };
    expect(decideNextTouch(input)).toMatchObject({ action: "skip", reason: "template_not_approved", step: { touch: "t1" } });
  });

  it("limite de marketing da Meta (131049): espera 24h e desiste na segunda vez", () => {
    const first = sp(9);
    const limited = (at: Date) => ({ touch: "t2" as const, template: "anc_t2_beneficio", at: at.toISOString(), status: "failed" as const, errorCode: "131049" });
    const touches = [
      { touch: "t0" as const, template: "anc_t0_direta", at: first.toISOString(), status: "sent" as const },
      { touch: "t1" as const, template: "anc_t1_lembrete", at: sp(9, 20).toISOString(), status: "sent" as const },
      limited(sp(12)),
    ];
    expect(decideNextTouch({ ...base(first, { touches }), now: sp(14) }).action).toBe("wait");
    expect(decideNextTouch({ ...base(first, { touches }), now: sp(13, 0, 22) })).toMatchObject({ action: "send", step: { touch: "t2" } });
    expect(decideNextTouch({ ...base(first, { touches: [...touches, limited(sp(13, 0, 22))] }), now: sp(15, 0, 23) })).toEqual({ action: "stop", reason: "meta_limit" });
  });

  it("termina depois da despedida", () => {
    const first = sp(9);
    const touches = (["t0", "t1", "t2", "t3", "t4"] as const).map((touch) => ({ touch, template: null, at: first.toISOString(), status: "sent" as const }));
    expect(decideNextTouch({ ...base(first, { touches }), now: sp(12, 0, 25) })).toEqual({ action: "stop", reason: "finished" });
  });
});

describe("pacote de templates", () => {
  it("primeiro contato e lembrete são utilidade; reengajamento é marketing", () => {
    for (const template of RECOMMENDED_TEMPLATES) {
      expect(template.category, template.name).toBe(["t0", "t1"].includes(template.touch) ? "UTILITY" : "MARKETING");
      expect(template.buttons.length).toBeGreaterThan(0);
      expect(template.buttons.length).toBeLessThanOrEqual(3);
      expect(template.body).not.toMatch(/—/);
    }
  });

  it("utilidade não usa linguagem promocional", () => {
    for (const template of RECOMMENDED_TEMPLATES.filter((item) => item.category === "UTILITY")) {
      expect(template.body, template.name).not.toMatch(/promo|desconto|melhor preço|oferta|grátis|bolso|imperd/i);
    }
  });

  it("monta o payload com parâmetros nomeados e exemplos", () => {
    const template = RECOMMENDED_TEMPLATES.find((item) => item.name === "anc_t0_operadora")!;
    expect(templateVariableOrder(template.body)).toEqual(["nome", "operadora", "empresa"]);
    const payload = toMetaTemplatePayload(template);
    expect(payload.parameter_format).toBe("NAMED");
    expect(JSON.stringify(payload.components)).toContain("\"param_name\":\"operadora\"");
    expect(JSON.stringify(payload.components)).toContain("QUICK_REPLY");
  });
});

describe("formulário entra na memória antes da primeira pergunta", () => {
  it("usa tipo de plano, vidas e cidade respondidos no anúncio", async () => {
    const { seedMemoryFromLeadForm } = await import("./form-seed");
    const { createEmptyMemory } = await import("@/features/ai-agent/memory");
    const result = seedMemoryFromLeadForm(createEmptyMemory(), {
      sourceMetadata: { tipoPlano: "Familiar", formAnswers: ["Quantas vidas?: 3", "Qual sua cidade?: Duque de Caxias"] },
    });
    expect(result.memory.planType?.value).toBe("familiar");
    expect(result.memory.numberOfLives?.value).toBe("3");
    expect(result.memory.city?.value).toBe("Duque de Caxias");
    expect(result.seeded).toEqual(expect.arrayContaining(["planType", "numberOfLives", "city"]));
  });

  it("empresa com CNPJ pelo formulário", async () => {
    const { seedMemoryFromLeadForm } = await import("./form-seed");
    const { createEmptyMemory } = await import("@/features/ai-agent/memory");
    const result = seedMemoryFromLeadForm(createEmptyMemory(), { tipo: "PJ", sourceMetadata: { tipoCnpj: "MEI" } });
    expect(result.memory.planType?.value).toBe("empresarial");
    expect(result.memory.companyHasCnpj?.value).toBe("true");
  });

  it("não inventa nada sem resposta clara", async () => {
    const { seedMemoryFromLeadForm } = await import("./form-seed");
    const { createEmptyMemory } = await import("@/features/ai-agent/memory");
    expect(seedMemoryFromLeadForm(createEmptyMemory(), { sourceMetadata: { formAnswers: ["Melhor horário?: manhã"] } }).seeded).toEqual([]);
  });
});

describe("lembrete retido pela fila (revisão 21/10)", () => {
  it("tenta de novo o mesmo toque, no máximo três vezes", () => {
    const first = new Date(Date.UTC(2026, 9, 21, 13));
    const held = (minutes: number) => ({ touch: "t1" as const, template: "anc_t1_lembrete", at: new Date(first.getTime() + minutes * 60_000).toISOString(), status: "failed" as const, errorCode: "held" });
    const state = (touches: TurboState["touches"]): TurboState => ({ approach: "direta", variant: null, firstContactAt: first.toISOString(), touches: [{ touch: "t0", template: null, at: first.toISOString(), status: "sent" }, ...touches] });
    const input = (touches: TurboState["touches"]) => ({ state: state(touches), now: new Date(first.getTime() + 40 * 60_000), lastInboundAt: null, optedOut: false, humanActive: false, assignedToBroker: false, closed: false, approvedTemplates: new Set(CADENCE.map((step) => step.template)) });
    expect(decideNextTouch(input([held(20)]))).toMatchObject({ action: "send", step: { touch: "t1" } });
    const afterThree = decideNextTouch(input([held(20), held(22), held(24)]));
    expect(afterThree.action === "send" ? afterThree.step.touch : afterThree.action).not.toBe("t1");
  });
});

describe("regra da Meta para variáveis (21/10)", () => {
  it("nenhum template começa ou termina com variável", () => {
    for (const template of RECOMMENDED_TEMPLATES) {
      expect(template.body.trim().startsWith("{{"), template.name).toBe(false);
      expect(/\}\}[.!?]?$/.test(template.body.trim()), template.name).toBe(false);
    }
  });
});

describe("qualificationTemplateVariables", () => {
  it("never sends an empty variable: an unknown operator is left out (PME campaign, 22/10)", () => {
    const pme = { sourceCampaign: "Plantão PME - [CBO] [GNDIPME_03] [1-1-10] - 15/09/2025", sourceMetadata: null };
    expect(resolveApproach(pme).id).toBe("pme");
    const variables = qualificationTemplateVariables("Ana", "Assistente", "Âncora Saúde", requestedOperator(pme));
    expect(variables).toEqual(["Ana", "Assistente", "Âncora Saúde"]);
    expect(variables.every((value) => value.trim().length > 0)).toBe(true);
  });

  it("keeps the operator when the campaign names one", () => {
    expect(qualificationTemplateVariables("Ana", "Assistente", "Âncora Saúde", "Amil")).toEqual(["Ana", "Assistente", "Âncora Saúde", "Amil"]);
    expect(qualificationTemplateVariables("", "", "", "  ")).toEqual(["Cliente", "Assistente", "Âncora Saúde"]);
  });
});
