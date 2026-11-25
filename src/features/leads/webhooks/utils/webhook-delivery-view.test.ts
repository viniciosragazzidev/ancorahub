import { describe, expect, it } from "vitest";

import { describeWebhookDelivery, formatLastReceived, translateWebhookErrorCode, WEBHOOK_REASON_FALLBACK } from "./webhook-delivery-view";

const now = new Date("2026-11-25T15:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("translateWebhookErrorCode", () => {
  it("traduz os códigos que o recebedor grava", () => {
    expect(translateWebhookErrorCode("INVALID_PAYLOAD")).toBe("Dados incompletos ou inválidos, como nome ou telefone");
    expect(translateWebhookErrorCode("BRANCH_NOT_FOUND")).toBe("Nenhuma filial ou fila ativa para receber o lead");
    expect(translateWebhookErrorCode("IDEMPOTENCY_CONFLICT")).toBe("Mesmo código de envio com dados diferentes");
    expect(translateWebhookErrorCode("RATE_LIMITED")).toBe("Muitos envios em pouco tempo");
    expect(translateWebhookErrorCode(" invalid_payload ")).toBe("Dados incompletos ou inválidos, como nome ou telefone");
  });

  it("cai em Motivo não informado sem código ou com código desconhecido", () => {
    expect(translateWebhookErrorCode(null)).toBe(WEBHOOK_REASON_FALLBACK);
    expect(translateWebhookErrorCode("")).toBe(WEBHOOK_REASON_FALLBACK);
    expect(translateWebhookErrorCode("ALGO_NOVO")).toBe("Motivo não informado");
  });

  it("nunca usa travessão", () => {
    for (const code of ["INVALID_PAYLOAD", "INVALID_JSON", "BRANCH_NOT_FOUND", "IDEMPOTENCY_CONFLICT", "UNAUTHORIZED", "TENANT_INACTIVE", "PAYLOAD_TOO_LARGE", "RATE_LIMITED", "INTERNAL_ERROR"]) {
      expect(translateWebhookErrorCode(code)).not.toContain("—");
    }
  });
});

describe("describeWebhookDelivery", () => {
  it("lead criado pela entrega entrou", () => {
    expect(describeWebhookDelivery({ status: "processed", errorCode: null, leadId: "lead-1", receivedAt: minutesAgo(2), leadCreatedAt: minutesAgo(2) }, now))
      .toEqual({ situation: "entered", reason: null, leadId: "lead-1" });
  });

  it("lead que já existia antes do envio é duplicado", () => {
    expect(describeWebhookDelivery({ status: "processed", errorCode: null, leadId: "lead-1", receivedAt: minutesAgo(2), leadCreatedAt: minutesAgo(60 * 24) }, now))
      .toEqual({ situation: "duplicate", reason: "O contato já era um lead e voltou a chegar", leadId: "lead-1" });
  });

  it("diferença pequena de relógio não vira duplicado", () => {
    const receivedAt = minutesAgo(2);
    expect(describeWebhookDelivery({ status: "processed", errorCode: null, leadId: "lead-1", receivedAt, leadCreatedAt: new Date(receivedAt.getTime() - 5_000) }, now).situation).toBe("entered");
  });

  it("rejeitado não entrou e mostra o motivo traduzido", () => {
    expect(describeWebhookDelivery({ status: "rejected", errorCode: "BRANCH_NOT_FOUND", leadId: null, receivedAt: minutesAgo(1), leadCreatedAt: null }, now))
      .toEqual({ situation: "not_entered", reason: "Nenhuma filial ou fila ativa para receber o lead", leadId: null });
    expect(describeWebhookDelivery({ status: "failed", errorCode: null, leadId: null, receivedAt: minutesAgo(1), leadCreatedAt: null }, now).reason).toBe("Motivo não informado");
  });

  it("recebido sem lead está em processamento e, depois de 5 min, parado", () => {
    expect(describeWebhookDelivery({ status: "received", errorCode: null, leadId: null, receivedAt: minutesAgo(1), leadCreatedAt: null }, now))
      .toEqual({ situation: "not_entered", reason: "Ainda em processamento", leadId: null });
    expect(describeWebhookDelivery({ status: "received", errorCode: null, leadId: null, receivedAt: minutesAgo(30), leadCreatedAt: null }, now).reason)
      .toBe("O processamento parou antes de criar o lead");
  });
});

describe("formatLastReceived", () => {
  it("mostra Nunca recebeu sem data", () => {
    expect(formatLastReceived(null, now)).toBe("Nunca recebeu");
  });

  it("mostra há X em pt-BR", () => {
    expect(formatLastReceived(new Date(now.getTime() - 10_000), now)).toBe("Último recebimento agora");
    expect(formatLastReceived(minutesAgo(5), now)).toMatch(/^Último recebimento há 5 min/);
    expect(formatLastReceived(minutesAgo(180), now)).toMatch(/^Último recebimento há 3 h/);
  });
});
