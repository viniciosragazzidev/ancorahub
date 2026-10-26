import { describe, expect, it } from "vitest";

import { computeNegotiationLevel } from "./negotiation-model";

const now = new Date("2026-10-26T15:00:00.000Z");
const base = {
  status: "in_contact",
  stageEnteredAt: "2026-10-20T12:00:00.000Z",
  assignedAt: "2026-10-20T12:00:00.000Z",
  now,
  lastCustomerMessageAt: "2026-10-26T14:00:00.000Z",
  lastBrokerMessageAt: "2026-10-26T13:50:00.000Z",
  twoWayExchangeDaysLast5: 1,
  customerSentPdf: false,
  customerSentImage: false,
  hasBrokerMessageEver: true,
  hasAnyMessageEver: true,
  ai: null,
};

describe("computeNegotiationLevel", () => {
  it("classifica troca recente sem sinais de avanço como em conversa", () => {
    expect(computeNegotiationLevel(base).level).toBe("in_conversation");
  });

  it("classifica avançada com troca recente em dois dias e etapa comercial", () => {
    expect(computeNegotiationLevel({
      ...base,
      status: "negotiation",
      twoWayExchangeDaysLast5: 2,
    }).level).toBe("advanced");
  });

  it("classifica fechamento por documento do cliente e troca recente", () => {
    expect(computeNegotiationLevel({
      ...base,
      status: "under_analysis",
      customerSentPdf: true,
    }).level).toBe("closing");
  });

  it("reconhece fechamento por imagem somente quando a IA indica coleta", () => {
    const result = computeNegotiationLevel({
      ...base,
      customerSentImage: true,
      ai: { conversationStage: "DOCUMENT_COLLECTION" },
    });
    expect(result.level).toBe("closing");
  });

  it("marca etapa comercial sem mensagem do corretor como sem conversa no CRM", () => {
    expect(computeNegotiationLevel({
      ...base,
      status: "quote_sent",
      lastCustomerMessageAt: null,
      lastBrokerMessageAt: null,
      hasBrokerMessageEver: false,
      hasAnyMessageEver: false,
    }).level).toBe("no_crm_conversation");
  });

  it("marca cliente aguardando há quatro horas como esfriando", () => {
    const result = computeNegotiationLevel({
      ...base,
      lastCustomerMessageAt: "2026-10-26T10:00:00.000Z",
      lastBrokerMessageAt: "2026-10-25T12:00:00.000Z",
    });
    expect(result.level).toBe("cooling");
    expect(result.customerWaiting).toBe(true);
    expect(result.replyOwedBy).toBe("broker");
  });

  it("conta cliente aguardando antes de entrar na régua principal", () => {
    const result = computeNegotiationLevel({
      ...base,
      lastCustomerMessageAt: "2026-10-26T14:30:00.000Z",
      lastBrokerMessageAt: null,
      hasBrokerMessageEver: false,
    });
    expect(result.level).toBeNull();
    expect(result.customerWaiting).toBe(true);
    expect(result.replyOwedBy).toBe("broker");
  });

  it("sinaliza troca antiga como esfriando e deixa fora lead sem sinais", () => {
    expect(computeNegotiationLevel({
      ...base,
      status: "negotiation",
      lastCustomerMessageAt: "2026-10-22T10:00:00.000Z",
      lastBrokerMessageAt: "2026-10-22T11:00:00.000Z",
      now: new Date("2026-10-26T15:00:00.000Z"),
    }).level).toBe("cooling");
    expect(computeNegotiationLevel({
      ...base,
      lastCustomerMessageAt: null,
      lastBrokerMessageAt: null,
      hasBrokerMessageEver: false,
      hasAnyMessageEver: false,
    }).level).toBeNull();
  });

  it("mostra quando a IA está à frente da etapa do CRM", () => {
    expect(computeNegotiationLevel({
      ...base,
      status: "quote_sent",
      ai: { conversationStage: "NEGOTIATION" },
    }).statusBehindAi).toBe(true);
  });
});
