import { describe, expect, it } from "vitest";

import { amountOrNoData, brokerCommissionState, formatBrokerCents, periodLabel } from "./broker-finance-core";

describe("estado da parcela para o corretor", () => {
  it("lançamento aprovado e coberto pela liquidação confirmada: paga", () => {
    expect(brokerCommissionState({ scheduleStatus: "pending", entry: { status: "approved", amountCents: 100, settledCents: 100 } })).toEqual({ state: "paga", source: "erp" });
  });
  it("lançamento aprovado ainda não coberto: conferida", () => {
    expect(brokerCommissionState({ scheduleStatus: "pending", entry: { status: "approved", amountCents: 100, settledCents: 40 } })).toEqual({ state: "conferida", source: "erp" });
  });
  it("lançamento aguardando aprovação ou rejeitado não confere: vale o cronograma", () => {
    expect(brokerCommissionState({ scheduleStatus: "pending", entry: { status: "submitted", amountCents: 100, settledCents: 0 } }).state).toBe("prevista");
    expect(brokerCommissionState({ scheduleStatus: "pending", entry: { status: "rejected", amountCents: 100, settledCents: 0 } }).state).toBe("prevista");
  });
  it("sem ERP, mostra o estado do cronograma", () => {
    expect(brokerCommissionState({ scheduleStatus: "pending", entry: null })).toEqual({ state: "prevista", source: "cronograma" });
    expect(brokerCommissionState({ scheduleStatus: "paid", entry: null })).toEqual({ state: "paga", source: "cronograma" });
    expect(brokerCommissionState({ scheduleStatus: "cancelled", entry: null }).state).toBe("cancelada");
    expect(brokerCommissionState({ scheduleStatus: "chargeback_pending", entry: null }).state).toBe("estorno");
  });
  it("o ERP manda sobre o cronograma depois que aprova (DEC-185)", () => {
    expect(brokerCommissionState({ scheduleStatus: "paid", entry: { status: "approved", amountCents: 100, settledCents: 0 } }).state).toBe("conferida");
  });
});

describe("sem dado não vira zero", () => {
  it("sem base devolve null e com base devolve o valor, mesmo zero", () => {
    expect(amountOrNoData(0, 0)).toBeNull();
    expect(amountOrNoData(2, 0)).toBe(0);
  });
  it("formata BRL e mostra Sem dado", () => {
    expect(formatBrokerCents(null)).toBe("Sem dado");
    expect(formatBrokerCents(123_456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(formatBrokerCents(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
  it("período por extenso", () => {
    expect(periodLabel("2026-11")).toBe("novembro de 2026");
  });
});
