import { describe, it, expect } from "vitest";
import { isAiPotentialSale } from "../change-lead-status";

describe("Protecao de Regressao da IA - isAiPotentialSale", () => {
  it("detects high purchase intent as potential sale", () => {
    const check1 = isAiPotentialSale({
      aiIntelligence: {
        customerIntent: "VERY_HIGH",
      },
    });
    expect(check1.isPotentialSale).toBe(true);
    expect(check1.reason).toContain("VERY_HIGH");

    const check2 = isAiPotentialSale({
      aiIntelligence: {
        customerIntent: "HIGH",
      },
    });
    expect(check2.isPotentialSale).toBe(true);
    expect(check2.reason).toContain("HIGH");
  });

  it("detects buying signals as potential sale", () => {
    const check = isAiPotentialSale({
      aiIntelligence: {
        customerIntent: "MEDIUM",
        buyingSignals: ["Solicitou dados para pagamento", "Pediu para emitir apolice"],
      },
    });
    expect(check.isPotentialSale).toBe(true);
    expect(check.reason).toContain("Sinais de compra detectados");
  });

  it("detects advanced negotiation / closing stages as potential sale", () => {
    const checkNegotiation = isAiPotentialSale({
      aiIntelligence: {
        conversationStage: "NEGOTIATION",
      },
    });
    expect(checkNegotiation.isPotentialSale).toBe(true);
    expect(checkNegotiation.reason).toContain("NEGOTIATION");

    const checkClosing = isAiPotentialSale({
      aiIntelligence: {
        conversationStage: "CLOSING",
      },
    });
    expect(checkClosing.isPotentialSale).toBe(true);
    expect(checkClosing.reason).toContain("CLOSING");

    const checkDocs = isAiPotentialSale({
      aiIntelligence: {
        conversationStage: "DOCUMENT_COLLECTION",
      },
    });
    expect(checkDocs.isPotentialSale).toBe(true);
    expect(checkDocs.reason).toContain("DOCUMENT_COLLECTION");
  });

  it("returns false for low intent or unqualified conversations", () => {
    expect(
      isAiPotentialSale({
        aiIntelligence: {
          customerIntent: "LOW",
          conversationStage: "GREETING",
          buyingSignals: [],
        },
      }).isPotentialSale,
    ).toBe(false);

    expect(isAiPotentialSale(null).isPotentialSale).toBe(false);
    expect(isAiPotentialSale({}).isPotentialSale).toBe(false);
    expect(isAiPotentialSale({ aiIntelligence: null }).isPotentialSale).toBe(false);
  });
});
