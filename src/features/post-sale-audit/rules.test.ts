import { describe, expect, it } from "vitest";
import { evaluatePostSaleEligibility, findUnknownPostSaleOpeningVariables, firstName, isPostSaleOptedOut, pickPostSaleSourceMessage, renderPostSaleOpeningMessage } from "./rules";
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
