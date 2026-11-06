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

  it("PDF ou foto do cliente sozinhos nunca põem em fechamento: vale a leitura da conversa (06/11)", () => {
    expect(computeNegotiationLevel({ ...base, customerSentPdf: true }).level).toBe("in_conversation");
    expect(computeNegotiationLevel({ ...base, status: "quote_sent", customerSentPdf: true, customerSentImage: true, twoWayExchangeDaysLast5: 3 }).level).toBe("advanced");
  });

  it("reconhece fechamento pela leitura da IA só depois da cotação no CRM", () => {
    const result = computeNegotiationLevel({
      ...base,
      status: "quote_sent",
      customerSentImage: true,
      ai: { conversationStage: "DOCUMENT_COLLECTION" },
    });
    expect(result.level).toBe("closing");
  });

  it("não põe em fechamento lead ainda em atendimento, mesmo com a IA lendo fechamento (06/11)", () => {
    expect(computeNegotiationLevel({ ...base, ai: { conversationStage: "CLOSING" } }).level).toBe("in_conversation");
    expect(computeNegotiationLevel({ ...base, customerSentPdf: true, twoWayExchangeDaysLast5: 3, ai: { conversationStage: "DOCUMENT_COLLECTION" } }).level).toBe("in_conversation");
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
      lastCustomerMessageAt: "2026-10-26T11:00:00.000Z",
      lastBrokerMessageAt: "2026-10-26T10:50:00.000Z",
    });
    expect(result.level).toBe("cooling");
    expect(result.customerWaiting).toBe(true);
    expect(result.replyOwedBy).toBe("broker");
  });

  it("mantém o nível avançado com selo de espera quando o cliente aguarda há quatro horas", () => {
    const result = computeNegotiationLevel({
      ...base,
      status: "negotiation",
      twoWayExchangeDaysLast5: 2,
      lastCustomerMessageAt: "2026-10-26T10:00:00.000Z",
      lastBrokerMessageAt: "2026-10-26T09:50:00.000Z",
    });
    expect(result.level).toBe("advanced");
    expect(result.customerWaiting).toBe(true);
    expect(result.replyOwedBy).toBe("broker");
  });

  it("mantém o nível de fechamento com selo de espera quando o cliente aguarda há quatro horas", () => {
    const result = computeNegotiationLevel({
      ...base,
      status: "under_analysis",
      customerSentPdf: true,
      lastCustomerMessageAt: "2026-10-26T10:00:00.000Z",
      lastBrokerMessageAt: "2026-10-26T09:50:00.000Z",
    });
    expect(result.level).toBe("closing");
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
      status: "under_analysis",
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
