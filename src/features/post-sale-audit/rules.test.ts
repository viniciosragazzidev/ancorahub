import { describe, expect, it } from "vitest";
import { evaluatePostSaleEligibility, findUnknownPostSaleOpeningVariables, firstName, isPostSaleOptedOut, choosePostSaleSource, isPostSaleWahaNumberAllowed, pickPostSaleCompanyWaha, pickPostSaleSourceMessage, renderPostSaleOpeningMessage } from "./rules";
import { isApprovedPostSaleMetaTemplate, POST_SALE_META_TEMPLATE, POST_SALE_WAHA_OPENING_DEFAULT } from "./template-contract";

const eligible = {
  phone: "+55 (21) 99999-1234",
  brokerId: "broker-1",
  optedOut: false,
  wrongNumber: false,
  recentSurvey: false,
  humanActive: false,
  sourceAvailable: true,
  templateApproved: true,
};

describe("post-sale audience rules", () => {
  it.each([
    ["invalid_phone", { phone: "123" }],
    ["opted_out", { optedOut: true }],
    ["wrong_number", { wrongNumber: true }],
    ["recent_survey", { recentSurvey: true }],
    ["human_active", { humanActive: true }],
    ["unassigned", { brokerId: null }],
    ["source_unavailable", { sourceAvailable: false }],
    ["template_unapproved", { templateApproved: false }],
  ] as const)("excludes %s", (reason, override) => {
    expect(evaluatePostSaleEligibility({ ...eligible, ...override })).toBe(reason);
  });

  it("accepts only an eligible lead", () => {
    expect(evaluatePostSaleEligibility(eligible)).toBeNull();
  });

  it("keeps an opt-out effective even if no AI conversation exists or the survey is old", () => {
    expect(isPostSaleOptedOut({ durableOptOut: true })).toBe(true);
    expect(isPostSaleOptedOut({ optedOutSurvey: true })).toBe(true);
    expect(isPostSaleOptedOut({ conversationOptOutAt: new Date() })).toBe(true);
    expect(isPostSaleOptedOut({})).toBe(false);
  });

  it("uses the first outbound channel when the lead has never sent an inbound message", () => {
    expect(pickPostSaleSourceMessage([
      { direction: "outgoing", provider: "meta_cloud", communicationChannelId: "first-contact", wahaNumberId: null },
      { direction: "outbound", provider: "waha", communicationChannelId: null, wahaNumberId: "later-number" },
    ])).toMatchObject({ communicationChannelId: "first-contact" });
  });

  it("prefers the first customer inbound channel over earlier outbound messages", () => {
    expect(pickPostSaleSourceMessage([
      { direction: "outgoing", provider: "waha", communicationChannelId: null, wahaNumberId: "first-contact" },
      { direction: "incoming", provider: "meta_cloud", communicationChannelId: "customer-source", wahaNumberId: null },
    ])).toMatchObject({ communicationChannelId: "customer-source" });
  });

  it("renders the presentation without leaving known placeholders", () => {
    expect(renderPostSaleOpeningMessage(POST_SALE_WAHA_OPENING_DEFAULT, {
      nome: "Ana", assistente: "Bia", empresa: "Âncora", corretor: "João",
    })).toContain("Oi, Ana! Tudo bem? Aqui é a Bia");
    expect(findUnknownPostSaleOpeningVariables("Olá {{nome}} da {{unidade}}.")).toEqual(["unidade"]);
    expect(firstName("  Ana   Maria  ")).toBe("Ana");
  });

  it("accepts only the approved post-sale template contract for the source WABA", () => {
    expect(isApprovedPostSaleMetaTemplate({
      language: POST_SALE_META_TEMPLATE.language,
      category: "MARKETING",
      bodyText: POST_SALE_META_TEMPLATE.body,
      variables: ["1", "2", "3"],
      buttons: POST_SALE_META_TEMPLATE.quickReplies.map((text) => ({ type: "QUICK_REPLY", text })),
    })).toBe(true);
    expect(isApprovedPostSaleMetaTemplate({
      language: "pt_BR", category: "UTILITY", bodyText: "Outro texto",
      variables: ["1", "2", "3"], buttons: POST_SALE_META_TEMPLATE.quickReplies.map((text) => ({ type: "QUICK_REPLY", text })),
    })).toBe(false);
  });
});

describe("pickPostSaleCompanyWaha", () => {
  const now = new Date("2026-11-06T15:00:00Z");
  const company = { id: "w-company", scope: "tenant", branchId: null, status: "active", pausedUntil: null };
  const unit = { id: "w-unit", scope: "branch", branchId: "b1", status: "active", pausedUntil: null };

  it("prefere o número da unidade do lead", () => {
    expect(pickPostSaleCompanyWaha([company, unit], "b1", now)?.id).toBe("w-unit");
  });

  it("usa o número da empresa quando a unidade não tem número", () => {
    expect(pickPostSaleCompanyWaha([company, unit], "b2", now)?.id).toBe("w-company");
    expect(pickPostSaleCompanyWaha([company], null, now)?.id).toBe("w-company");
  });

  it("ignora número de outra unidade, pausado ou fora do ar", () => {
    expect(pickPostSaleCompanyWaha([unit], "b2", now)).toBeNull();
    expect(pickPostSaleCompanyWaha([{ ...company, pausedUntil: new Date("2026-11-06T16:00:00Z") }], null, now)).toBeNull();
    expect(pickPostSaleCompanyWaha([{ ...company, status: "error" }], null, now)).toBeNull();
  });
});

describe("isPostSaleWahaNumberAllowed", () => {
  it("aceita número da empresa e número da própria unidade do lead", () => {
    expect(isPostSaleWahaNumberAllowed({ scope: "tenant", branchId: null }, "b1")).toBe(true);
    expect(isPostSaleWahaNumberAllowed({ scope: "branch", branchId: "b1" }, "b1")).toBe(true);
  });

  it("recusa número de outra unidade, de unidade sem lead na unidade e de materiais", () => {
    expect(isPostSaleWahaNumberAllowed({ scope: "branch", branchId: "b1" }, "b2")).toBe(false);
    expect(isPostSaleWahaNumberAllowed({ scope: "branch", branchId: "b1" }, null)).toBe(false);
    expect(isPostSaleWahaNumberAllowed({ scope: "tenant_materials", branchId: null }, null)).toBe(false);
  });
});

describe("choosePostSaleSource", () => {
  const company = { type: "waha", ref: "w-company" };
  const companyWaha = () => company;

  it("fila com dois canais de entrada fica sem fonte, sem cair no número da empresa", () => {
    expect(choosePostSaleSource({ hasMessage: false, fromMessage: null, messageProvider: null, defaultState: { kind: "ambiguous" }, companyWaha })).toBeNull();
  });

  it("lead sem fonte nenhuma usa o número da empresa", () => {
    expect(choosePostSaleSource({ hasMessage: false, fromMessage: null, messageProvider: null, defaultState: { kind: "none" }, companyWaha })).toBe(company);
  });

  it("conversa pelo WhatsApp pessoal do corretor usa o número da empresa", () => {
    expect(choosePostSaleSource({ hasMessage: true, fromMessage: null, messageProvider: "waha", defaultState: null, companyWaha })).toBe(company);
  });

  it("origem própria vence; origem Meta sem canal não troca de número", () => {
    const meta = { type: "meta", ref: "c1" };
    expect(choosePostSaleSource({ hasMessage: true, fromMessage: meta, messageProvider: "meta_cloud", defaultState: null, companyWaha })).toBe(meta);
    expect(choosePostSaleSource({ hasMessage: true, fromMessage: null, messageProvider: "meta_cloud", defaultState: null, companyWaha })).toBeNull();
  });
});

describe("choosePostSaleSource no número oficial", () => {
  const company = { type: "waha", ref: "w-company" };
  const official = { type: "meta", ref: "c-default" };

  it("lead do número oficial sem canal registrado (ou canal desativado) usa o número oficial padrão", () => {
    expect(choosePostSaleSource({ hasMessage: true, fromMessage: null, messageProvider: "meta_cloud", messageIsMeta: true, defaultState: null, companyWaha: () => company, defaultMeta: () => official })).toBe(official);
  });

  it("sem número oficial padrão continua sem fonte, sem cair no WAHA", () => {
    expect(choosePostSaleSource({ hasMessage: true, fromMessage: null, messageProvider: "meta_cloud", messageIsMeta: true, defaultState: null, companyWaha: () => company, defaultMeta: () => null })).toBeNull();
  });
});
