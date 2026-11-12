import { describe, expect, it } from "vitest";

import { extractMoneyCents } from "./guardrails";
import { createPublicToken, hashPublicToken, isPublicLinkUsable, isPublicTokenShape, publicLinkExpiresAt, publicQuoteUrl, quoteLinkMessage } from "./public-link";
import { buildPublicQuoteView, whatsappLink } from "./public-quote-view";
import { offerFrom, result } from "./test-fixtures";

describe("link público da cotação", () => {
  it("token forte, só o hash vai ao banco", () => {
    const { token, hash } = createPublicToken();
    expect(isPublicTokenShape(token)).toBe(true);
    expect(hash).toBe(hashPublicToken(token));
    expect(hash).not.toContain(token);
    expect(createPublicToken().token).not.toBe(token);
    expect(isPublicTokenShape("../etc")).toBe(false);
  });

  it("vale até o fim do dia da validade e para de abrir se revogado", () => {
    const offer = offerFrom([result("a", 40000)]);
    const expiresAt = publicLinkExpiresAt(offer);
    expect(expiresAt.toISOString()).toBe("2026-11-20T02:59:59.000Z"); // 19/11 23h59 em Brasília
    expect(isPublicLinkUsable({ expiresAt, revokedAt: null, now: new Date("2026-11-19T20:00:00Z") })).toBe(true);
    expect(isPublicLinkUsable({ expiresAt, revokedAt: null, now: new Date("2026-11-20T03:00:00Z") })).toBe(false);
    expect(isPublicLinkUsable({ expiresAt, revokedAt: new Date(), now: new Date("2026-11-13T12:00:00Z") })).toBe(false);
  });

  it("a mensagem com o link não cita valor e o link fica em /compartilhado", () => {
    const url = publicQuoteUrl("abcDEF123_-abcDEF123_-abcDEF123_-", "https://crm.exemplo.test/");
    expect(url).toBe("https://crm.exemplo.test/compartilhado/cotacao/abcDEF123_-abcDEF123_-abcDEF123_-");
    expect(extractMoneyCents(quoteLinkMessage(url))).toEqual([]);
    expect(quoteLinkMessage(url)).not.toMatch(/[—–]/);
  });
});

describe("página pública", () => {
  const view = buildPublicQuoteView({
    offer: offerFrom([result("a", 38990), result("b", 45000)], { recommendedPlanId: "b", recommendationReason: "Eu indicaria o Op b Plano b." }),
    facts: { firstName: "Joana", ages: [30], city: "Niterói" },
    brokerage: { name: "Âncora Saúde", units: ["Niterói Centro"], whatsappPhone: "(21) 99999-0000" },
    promotions: [],
    network: null,
  });

  it("mostra só primeiro nome, idades e os valores do snapshot", () => {
    expect(view.firstName).toBe("Joana");
    expect(view.plans.map((plan) => plan.total)).toEqual(["R$ 389,90", "R$ 450,00"]);
    expect(view.plans.find((plan) => plan.recommended)?.id).toBe("b");
    // Nenhum contato do cliente na página (o único telefone é o da corretora, no botão).
    expect(JSON.stringify({ ...view, whatsappUrl: null })).not.toMatch(/\d{8,}|@/);
    expect(view.validUntil).toBe("19/11/2026");
  });

  it("botão do WhatsApp com a corretora e o plano recomendado", () => {
    expect(view.whatsappUrl).toBe(`https://wa.me/5521999990000?text=${encodeURIComponent("Quero seguir com o Op b Plano b.")}`);
    expect(whatsappLink(null, "x")).toBeNull();
  });
});
