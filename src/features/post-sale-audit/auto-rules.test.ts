import { describe, expect, it } from "vitest";

import { autoRuleCampaignId, autoRuleSurveyId } from "./auto-rule-ids";
import {
  addBusinessDaysToDateKey,
  AUTO_RULE_DEFINITIONS,
  AUTO_RULE_KEYS,
  AUTO_RULE_SKIP_LABELS,
  autoRuleMilestoneFloor,
  autoRuleRemainingCapacity,
  autoRuleSettingsInputSchema,
  autoRuleTiming,
  decideAutoRuleCandidate,
  defaultAutoRuleSettings,
  effectiveAutoRuleDailyLimit,
  isAutoRuleLossReasonExcluded,
  matchesPostSaleRuleFilter,
  parseAutoRuleRow,
  parsePostSaleRuleFilter,
  postSaleRuleLabel,
  saoPauloDateKey,
  type AutoRuleLeadFacts,
  type AutoRuleSettings,
} from "./auto-rules";
import { aggregatePostSaleBrokerReport } from "./reporting";

const EM_DASH = String.fromCharCode(0x2014);
// Sexta, 06/11/2026, 15h em São Paulo.
const fridayMilestone = new Date("2026-11-06T18:00:00Z");
const mondayNoon = new Date("2026-11-09T15:00:00Z");

function settings(overrides: Partial<AutoRuleSettings> = {}): AutoRuleSettings {
  return { ...defaultAutoRuleSettings("R1"), enabled: true, ...overrides };
}

function lead(overrides: Partial<AutoRuleLeadFacts> = {}): AutoRuleLeadFacts {
  return { status: "in_contact", queueId: "q1", branchId: "b1", tipo: "PF", brokerId: "u1", ownerRole: "broker", distributionStatus: "assigned", assignmentSource: "whatsapp_offer_accepted", lossTexts: [], ...overrides };
}

describe("dias úteis", () => {
  it("pula o fim de semana", () => {
    expect(addBusinessDaysToDateKey("2026-11-06", 1)).toBe("2026-11-09");
    expect(addBusinessDaysToDateKey("2026-11-07", 1)).toBe("2026-11-09");
    expect(addBusinessDaysToDateKey("2026-11-09", 5)).toBe("2026-11-16");
    expect(addBusinessDaysToDateKey("2026-11-07", 0)).toBe("2026-11-09");
    expect(addBusinessDaysToDateKey("2026-11-06", 30)).toBe("2026-12-18");
  });

  it("usa o calendário de São Paulo, não o UTC", () => {
    // 23h30 de sexta em São Paulo já é sábado em UTC.
    expect(saoPauloDateKey(new Date("2026-11-07T02:30:00Z"))).toBe("2026-11-06");
  });

  it("marca o dia certo, a tolerância e o que ficou velho", () => {
    expect(autoRuleTiming({ milestoneAt: fridayMilestone, delayBusinessDays: 1, sendDay: "2026-11-06" })).toBe("early");
    expect(autoRuleTiming({ milestoneAt: fridayMilestone, delayBusinessDays: 1, sendDay: "2026-11-09" })).toBe("due");
    expect(autoRuleTiming({ milestoneAt: fridayMilestone, delayBusinessDays: 1, sendDay: "2026-11-11" })).toBe("due");
    expect(autoRuleTiming({ milestoneAt: fridayMilestone, delayBusinessDays: 1, sendDay: "2026-11-12" })).toBe("stale");
    expect(autoRuleTiming({ milestoneAt: fridayMilestone, delayBusinessDays: 5, sendDay: "2026-11-12" })).toBe("early");
    expect(autoRuleTiming({ milestoneAt: fridayMilestone, delayBusinessDays: 5, sendDay: "2026-11-13" })).toBe("due");
  });

  it("a busca começa antes de qualquer marco ainda no prazo", () => {
    for (const delay of [1, 2, 3, 5, 30]) {
      const sendDay = "2026-11-18";
      const floor = autoRuleMilestoneFloor(sendDay, delay);
      // O marco mais antigo ainda no prazo: dia de envio menos (atraso + tolerância) dias úteis.
      let day = sendDay;
      let back = 0;
      const cursor = new Date(`${sendDay}T12:00:00Z`);
      while (back < delay + 2) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) back += 1;
        day = cursor.toISOString().slice(0, 10);
      }
      expect(floor.getTime()).toBeLessThanOrEqual(new Date(`${day}T03:00:00Z`).getTime());
      expect(autoRuleTiming({ milestoneAt: new Date(`${day}T15:00:00Z`), delayBusinessDays: delay, sendDay })).toBe("due");
    }
  });
});

describe("decideAutoRuleCandidate", () => {
  const base = { milestoneAt: fridayMilestone, sendDay: "2026-11-09", now: mondayNoon };

  it("R1: lead aberto e aceito no dia certo entra", () => {
    expect(decideAutoRuleCandidate({ ...base, settings: settings(), lead: lead() })).toEqual({ ok: true });
  });

  it("regra desligada não entra, mas a prévia avalia como ligada", () => {
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ enabled: false }), lead: lead() })).toEqual({ ok: false, skip: "disabled" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ enabled: false }), lead: lead(), ignoreEnabled: true })).toEqual({ ok: true });
  });

  it("R1 e R2 só com lead aberto, aceito e fora da carteira de diretor", () => {
    expect(decideAutoRuleCandidate({ ...base, settings: settings(), lead: lead({ status: "converted" }) })).toEqual({ ok: false, skip: "not_open" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings(), lead: lead({ status: "lost" }) })).toEqual({ ok: false, skip: "not_open" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings(), lead: lead({ assignmentSource: "automatic_offer" }) })).toEqual({ ok: false, skip: "not_accepted" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings(), lead: lead({ distributionStatus: "queued" }) })).toEqual({ ok: false, skip: "not_accepted" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings(), lead: lead({ ownerRole: "director" }) })).toEqual({ ok: false, skip: "director_owner" });
  });

  it("R2 respeita a R1 respondida nos últimos 4 dias", () => {
    const r2 = settings({ ...defaultAutoRuleSettings("R2"), enabled: true, delayBusinessDays: 1 });
    expect(decideAutoRuleCandidate({ ...base, settings: r2, lead: lead(), lastR1AnswerAt: new Date(mondayNoon.getTime() - 2 * 86_400_000) })).toEqual({ ok: false, skip: "r1_answered" });
    expect(decideAutoRuleCandidate({ ...base, settings: r2, lead: lead(), lastR1AnswerAt: new Date(mondayNoon.getTime() - 5 * 86_400_000) })).toEqual({ ok: true });
  });

  it("R3 e R5 só com venda; R4 só com perda", () => {
    const r3 = settings({ ...defaultAutoRuleSettings("R3"), enabled: true, delayBusinessDays: 1 });
    expect(decideAutoRuleCandidate({ ...base, settings: r3, lead: lead({ status: "converted" }) })).toEqual({ ok: true });
    expect(decideAutoRuleCandidate({ ...base, settings: r3, lead: lead() })).toEqual({ ok: false, skip: "not_converted" });
    const r4 = settings({ ...defaultAutoRuleSettings("R4"), enabled: true, delayBusinessDays: 1 });
    expect(decideAutoRuleCandidate({ ...base, settings: r4, lead: lead({ status: "lost", lossTexts: ["preco"] }) })).toEqual({ ok: true });
    expect(decideAutoRuleCandidate({ ...base, settings: r4, lead: lead({ status: "converted" }) })).toEqual({ ok: false, skip: "not_lost" });
  });

  it("R4 não pergunta quando o motivo é número errado ou pediu para não contatar", () => {
    const r4 = settings({ ...defaultAutoRuleSettings("R4"), enabled: true, delayBusinessDays: 1 });
    for (const reason of ["Número errado", "numero_errado", "Pediu para não contatar", "cliente pediu para não ser contatado", "Não quer mais ser contatado", "telefone inválido"]) {
      expect(decideAutoRuleCandidate({ ...base, settings: r4, lead: lead({ status: "lost", lossTexts: ["outro", reason] }) })).toEqual({ ok: false, skip: "loss_reason" });
    }
    expect(isAutoRuleLossReasonExcluded(["sem_contato", "preco", "desistiu", null])).toBe(false);
  });

  it("aplica atraso, filtros e piloto", () => {
    expect(decideAutoRuleCandidate({ ...base, sendDay: "2026-11-06", settings: settings(), lead: lead() })).toEqual({ ok: false, skip: "early" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ filters: { queueIds: ["q2"], branchIds: [], leadTypes: [] } }), lead: lead() })).toEqual({ ok: false, skip: "filters" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ filters: { queueIds: [], branchIds: ["b2"], leadTypes: [] } }), lead: lead() })).toEqual({ ok: false, skip: "filters" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ filters: { queueIds: [], branchIds: [], leadTypes: ["PJ"] } }), lead: lead() })).toEqual({ ok: false, skip: "filters" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ pilot: { queueIds: ["q9"], brokerIds: [] } }), lead: lead() })).toEqual({ ok: false, skip: "not_in_pilot" });
    expect(decideAutoRuleCandidate({ ...base, settings: settings({ pilot: { queueIds: ["q9"], brokerIds: ["u1"] } }), lead: lead() })).toEqual({ ok: true });
  });
});

describe("limites", () => {
  it("piloto fica em 20 por dia; geral até 60", () => {
    expect(effectiveAutoRuleDailyLimit({ dailyLimit: 60, pilot: { queueIds: [], brokerIds: [] } })).toBe(60);
    expect(effectiveAutoRuleDailyLimit({ dailyLimit: 60, pilot: { queueIds: ["q1"], brokerIds: [] } })).toBe(20);
    expect(effectiveAutoRuleDailyLimit({ dailyLimit: 5, pilot: { queueIds: ["q1"], brokerIds: [] } })).toBe(5);
  });

  it("o que sobra é o menor entre a regra e a empresa", () => {
    const pilot = { dailyLimit: 60, pilot: { queueIds: ["q1"], brokerIds: [] } };
    expect(autoRuleRemainingCapacity({ settings: pilot, usedByRule: 5, usedByTenant: 10 })).toBe(15);
    expect(autoRuleRemainingCapacity({ settings: pilot, usedByRule: 5, usedByTenant: 55 })).toBe(5);
    expect(autoRuleRemainingCapacity({ settings: pilot, usedByRule: 25, usedByTenant: 25 })).toBe(0);
  });
});

describe("configuração", () => {
  it("tudo desligado por padrão, com o atraso do plano", () => {
    expect(AUTO_RULE_KEYS.map((key) => [key, defaultAutoRuleSettings(key).enabled, defaultAutoRuleSettings(key).delayBusinessDays])).toEqual([
      ["R1", false, 1], ["R2", false, 5], ["R3", false, 3], ["R4", false, 2], ["R5", false, 30],
    ]);
  });

  it("linha inválida volta ao padrão e nunca quebra", () => {
    expect(parseAutoRuleRow("R1", null)).toEqual(defaultAutoRuleSettings("R1"));
    const parsed = parseAutoRuleRow("R3", { enabled: true, delayBusinessDays: -2, dailyLimit: 500, filters: { queueIds: ["a", "a", 3], leadTypes: ["PJ", "X"] }, pilot: "bad" });
    expect(parsed).toMatchObject({ enabled: true, delayBusinessDays: 3, dailyLimit: 60, filters: { queueIds: ["a"], branchIds: [], leadTypes: ["PJ"] }, pilot: { queueIds: [], brokerIds: [] } });
  });

  it("valida a entrada do diretor", () => {
    expect(autoRuleSettingsInputSchema.safeParse({ key: "R1", enabled: true, delayBusinessDays: 0, dailyLimit: 10, filters: {}, pilot: {} }).success).toBe(false);
    expect(autoRuleSettingsInputSchema.safeParse({ key: "R9", enabled: true, delayBusinessDays: 1, dailyLimit: 10, filters: {}, pilot: {} }).success).toBe(false);
    expect(autoRuleSettingsInputSchema.parse({ key: "R1", enabled: true, delayBusinessDays: 1, dailyLimit: 20, filters: {}, pilot: { queueIds: ["q1"] } })).toMatchObject({ filters: { queueIds: [], branchIds: [], leadTypes: [] }, pilot: { queueIds: ["q1"], brokerIds: [] } });
  });
});

describe("idempotência", () => {
  it("campanha por empresa, regra e dia; survey por lead, regra e marco", () => {
    expect(autoRuleCampaignId("t1", "R1", "2026-11-09")).toBe(autoRuleCampaignId("t1", "R1", "2026-11-09"));
    expect(autoRuleCampaignId("t1", "R1", "2026-11-09")).not.toBe(autoRuleCampaignId("t1", "R2", "2026-11-09"));
    expect(autoRuleCampaignId("t1", "R1", "2026-11-09")).not.toBe(autoRuleCampaignId("t1", "R1", "2026-11-10"));
    expect(autoRuleCampaignId("t1", "R1", "2026-11-09")).not.toContain(":");
    expect(autoRuleSurveyId("t1", "l1", "R1", fridayMilestone)).toBe(autoRuleSurveyId("t1", "l1", "R1", new Date(fridayMilestone)));
    expect(autoRuleSurveyId("t1", "l1", "R1", fridayMilestone)).not.toBe(autoRuleSurveyId("t1", "l1", "R2", fridayMilestone));
    expect(autoRuleSurveyId("t1", "l1", "R1", fridayMilestone).length).toBeLessThanOrEqual(80);
  });
});

describe("relatório por regra", () => {
  it("rótulos e filtro por origem", () => {
    expect(postSaleRuleLabel(null)).toBe("Manual");
    expect(postSaleRuleLabel("R1")).toBe("R1 Checagem de atendimento");
    expect(parsePostSaleRuleFilter("R3")).toBe("R3");
    expect(parsePostSaleRuleFilter("x")).toBe("all");
    expect(matchesPostSaleRuleFilter(null, "manual")).toBe(true);
    expect(matchesPostSaleRuleFilter("R1", "manual")).toBe(false);
    expect(matchesPostSaleRuleFilter("R1", "R1")).toBe(true);
  });

  it("o relatório por corretor conta só a origem escolhida", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-30T00:00:00Z");
    const surveys = [
      { brokerId: "u1", sentAt: "2026-11-09T12:00:00Z", lastReplyAt: "2026-11-09T13:00:00Z", outcome: "ok", rating: 5, answers: { contacted: true }, alertsHandledAt: null, ruleKey: "R1" },
      { brokerId: "u1", sentAt: "2026-11-09T12:00:00Z", lastReplyAt: null, outcome: null, rating: null, answers: {}, alertsHandledAt: null, ruleKey: null },
    ];
    const brokers = [{ id: "u1", name: "Ana" }];
    expect(aggregatePostSaleBrokerReport({ brokers, surveys, from, to })[0]).toMatchObject({ sent: 2, responded: 1 });
    expect(aggregatePostSaleBrokerReport({ brokers, surveys, from, to, ruleFilter: "R1" })[0]).toMatchObject({ sent: 1, responded: 1, attended: 1 });
    expect(aggregatePostSaleBrokerReport({ brokers, surveys, from, to, ruleFilter: "manual" })[0]).toMatchObject({ sent: 1, responded: 0 });
  });

  it("textos sem travessão", () => {
    const texts = [...Object.values(AUTO_RULE_DEFINITIONS).flatMap((definition) => Object.values(definition).map(String)), ...Object.values(AUTO_RULE_SKIP_LABELS)];
    for (const text of texts) expect(text).not.toContain(EM_DASH);
  });
});
