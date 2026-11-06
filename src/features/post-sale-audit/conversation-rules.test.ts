import { describe, expect, it } from "vitest";
import { businessHoursBetween, detectPostSaleKeywords, isActivePostSaleSurvey, postSaleNextTurn } from "./conversation-rules";

describe("post-sale conversation rules", () => {
  it("routes only a fresh survey on the same channel and source number", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const base = { status: "sent", sentAt: new Date("2026-11-04T12:00:00Z"), channelType: "waha", channelRef: "waha-1" };
    expect(isActivePostSaleSurvey(base, { channelType: "waha", channelRef: "waha-1", now })).toBe(true);
    expect(isActivePostSaleSurvey(base, { channelType: "meta", channelRef: "meta-1", now })).toBe(false);
    expect(isActivePostSaleSurvey({ ...base, sentAt: new Date("2026-10-31T11:59:59Z") }, { channelType: "waha", channelRef: "waha-1", now })).toBe(false);
    expect(isActivePostSaleSurvey({ ...base, status: "completed" }, { channelType: "waha", channelRef: "waha-1", now })).toBe(false);
  });

  it("uses keyword fallback for contact, rating, quote and explicit stop", () => {
    expect(detectPostSaleKeywords("Sim, falou comigo e foi rápido. Nota 5, recebi a cotação.")).toMatchObject({ contacted: true, rating: 5, receivedQuote: true, speed: "fast" });
    expect(detectPostSaleKeywords("Pare, não quero mais mensagens.").optOut).toBe(true);
  });

  it("uses the active question to interpret short fallback answers", () => {
    expect(detectPostSaleKeywords("Sim", "se recebeu cotação").receivedQuote).toBe(true);
    expect(detectPostSaleKeywords("Não", "se recebeu cotação").receivedQuote).toBe(false);
    expect(detectPostSaleKeywords("Sim", "se ainda quer ajuda").wantsHelp).toBe(true);
    expect(detectPostSaleKeywords("Não", "se fechou o plano").closed).toBe("no");
    expect(detectPostSaleKeywords("O preço e o prazo pesaram", "motivo da decisão").reason).toBe("O preço e o prazo pesaram");
    expect(detectPostSaleKeywords("Sim", "permissão para fazer duas perguntas").contacted).toBeNull();
    expect(detectPostSaleKeywords("Não foi rápido, nota 1", "como foi o atendimento").contacted).toBeNull();
  });

  it("keeps one question at a time and never invents a price", () => {
    const first = postSaleNextTurn(0, {}, { contacted: null, comment: "Pode perguntar" }, { lead: "Ana", broker: "Bia" });
    expect(first.text).toContain("falar com Bia");
    expect(first.text).not.toMatch(/R\$|\d/);
    const second = postSaleNextTurn(1, {}, { contacted: true }, { lead: "Ana", broker: "Bia" });
    expect(second.text).toContain("Como foi o atendimento");
    expect(second.text).not.toContain("cotação");
    const third = postSaleNextTurn(2, {}, { rating: 4 }, { lead: "Ana", broker: "Bia" });
    expect(third.text).toBe("Você chegou a receber uma cotação?");
  });

  it("distinguishes decline from opt-out and finishes unanswered contacts", () => {
    expect(postSaleNextTurn(0, {}, detectPostSaleKeywords("Agora não"), { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "completed", outcome: "other" });
    expect(postSaleNextTurn(0, {}, detectPostSaleKeywords("Não"), { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "completed", outcome: "other" });
    expect(postSaleNextTurn(0, {}, detectPostSaleKeywords("Não quero mais"), { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "opted_out" });
    expect(postSaleNextTurn(3, { contacted: false }, { wantsHelp: true }, { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "completed", outcome: "no_contact" });
  });

  it("counts weekday business time, excluding nights and weekends", () => {
    expect(businessHoursBetween(new Date("2026-11-06T15:00:00Z"), new Date("2026-11-09T15:00:00Z"))).toBe(10 * 60 * 60_000);
  });
});
