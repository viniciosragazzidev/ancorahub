import { describe, expect, it } from "vitest";

import {
  buildPlantaoReportText,
  calculatePlantaoMetrics,
  classifyPlantaoLead,
  DEFAULT_PLANTAO_REPORT_CONFIG,
  findPlantaoReportGroupId,
  parsePlantaoReportConfig,
  type PlantaoOfferRow,
  type PlantaoReportMetrics,
} from "./plantao-report-core";

const start = new Date("2026-11-09T12:00:00.000Z");


describe("resultado do plantão", () => {
  it("usa o grupo padrão exato e busca por nome completo normalizado", () => {
    expect(DEFAULT_PLANTAO_REPORT_CONFIG.groupName).toBe("Fechamento Plantão Geral");
    expect(parsePlantaoReportConfig(undefined).enabled).toBe(false);
    expect(parsePlantaoReportConfig(undefined).groupName).toBe("Fechamento Plantão Geral");
    expect(findPlantaoReportGroupId([
      { id: "wrong@g.us", name: "Fechamento Plantão" },
      { id: "target@g.us", name: "FECHAMENTO PLANTAO GERAL" },
      { id: "private@c.us", name: "Fechamento Plantão Geral" },
    ], "Fechamento Plantão Geral")).toBe("target");
    expect(findPlantaoReportGroupId([{ id: "wrong@g.us", name: "Fechamento Plantão" }], "Fechamento Plantão Geral")).toBeNull();
  });

  it("classifica form antes de WhatsApp e considera anúncios e sem referência", () => {
    expect(classifyPlantaoLead({ hasFormAnswers: true, hasCtwaClid: true, hasWithoutReferral: false })).toBe("form");
    expect(classifyPlantaoLead({ hasFormAnswers: false, hasCtwaClid: true, hasWithoutReferral: false })).toBe("whatsapp");
    expect(classifyPlantaoLead({ hasFormAnswers: false, hasCtwaClid: false, hasWithoutReferral: true })).toBe("whatsapp");
    expect(classifyPlantaoLead({ hasFormAnswers: false, hasCtwaClid: false, hasWithoutReferral: false })).toBe("other");
  });

  it("agrega leads e corretores dos plantões PME antes de dividir", () => {
    const offers: PlantaoOfferRow[] = Array.from({ length: 10 }, (_, index) => ({
      leadId: `pme-a-lead-${index}`,
      brokerId: `broker-${index % 2}`,
      dutyScheduleId: "pme-a",
      dutyName: "PME Rio",
      originalQueueName: null,
      offeredAt: new Date("2026-11-09T12:00:00.000Z"),
    }));
    offers.push({
      leadId: "pme-b-lead-1",
      brokerId: "broker-0",
      dutyScheduleId: "pme-b",
      dutyName: "PME São Paulo",
      originalQueueName: null,
      offeredAt: new Date("2026-11-09T15:00:00.000Z"),
    });

    const metrics = calculatePlantaoMetrics([], offers, DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(metrics.quantity.pme).toBe(5.5);
  });

  it("agrega também corretores e leads de plantões Premium do mesmo grupo", () => {
    const offers: PlantaoOfferRow[] = Array.from({ length: 10 }, (_, index) => ({
      leadId: `premium-a-lead-${index}`,
      brokerId: `broker-${index % 2}`,
      dutyScheduleId: "premium-a",
      dutyName: "Premium Rio",
      originalQueueName: null,
      offeredAt: new Date("2026-11-09T12:00:00.000Z"),
    }));
    offers.push({
      leadId: "premium-b-lead-1",
      brokerId: "broker-0",
      dutyScheduleId: "premium-b",
      dutyName: "Premium São Paulo",
      originalQueueName: null,
      offeredAt: new Date("2026-11-09T12:30:00.000Z"),
    });

    const metrics = calculatePlantaoMetrics([], offers, DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(metrics.quantity.onlineMorning).toBe(5.5);
  });

  it("classifica por prefixo e mantém PME fora de outros grupos", () => {
    const offers: PlantaoOfferRow[] = [
      { leadId: "premium-1", brokerId: "b1", dutyScheduleId: "premium-1", dutyName: "Premium 09/11", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
      { leadId: "premium-2", brokerId: "b1", dutyScheduleId: "premium-1", dutyName: "Premium 09/11", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
      { leadId: "not-prefix-1", brokerId: "b1", dutyScheduleId: "not-prefix", dutyName: "Online Premium", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
      { leadId: "not-prefix-2", brokerId: "b1", dutyScheduleId: "not-prefix", dutyName: "Online Premium", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
      { leadId: "pme-premium-1", brokerId: "b2", dutyScheduleId: "pme-premium", dutyName: "PME Premium Especial", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
      { leadId: "pme-premium-2", brokerId: "b2", dutyScheduleId: "pme-premium", dutyName: "PME Premium Especial", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
      { leadId: "presencial-1", brokerId: "b3", dutyScheduleId: "presencial", dutyName: "Presencial · Manhã", originalQueueName: null, offeredAt: new Date("2026-11-09T12:00:00.000Z") },
    ];

    const metrics = calculatePlantaoMetrics([], offers, DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(metrics.quantity.pme).toBe(2);
    expect(metrics.quantity.onlineMorning).toBe(2);
    expect(metrics.quantity.inPersonMorning).toBe(1);
  });

  it("exclui Plantão Plus e a fila original Alessandra das indicações", () => {
    const offers: PlantaoOfferRow[] = [
      { leadId: "morning", brokerId: "b1", dutyScheduleId: "pme", dutyName: "PME Rio", originalQueueName: "Fila TATIANA", offeredAt: new Date("2026-11-09T16:29:00.000Z") },
      { leadId: "morning", brokerId: "b9", dutyScheduleId: "pme-other", dutyName: "PME Sul", originalQueueName: "Fila TATIANA", offeredAt: new Date("2026-11-09T16:28:00.000Z") },
      { leadId: "morning-no-schedule", brokerId: "b1", dutyScheduleId: null, dutyName: null, originalQueueName: null, offeredAt: new Date("2026-11-09T16:20:00.000Z") },
      { leadId: "plus-morning", brokerId: "b2", dutyScheduleId: "plus-am", dutyName: "Plantão Plus", originalQueueName: "Fila TATIANA", offeredAt: new Date("2026-11-09T16:10:00.000Z") },
      { leadId: "afternoon", brokerId: "b3", dutyScheduleId: "premium", dutyName: "Premium 09/11", originalQueueName: "Fila TATIANA", offeredAt: new Date("2026-11-09T16:30:00.000Z") },
      { leadId: "afternoon-alessandra", brokerId: "b4", dutyScheduleId: "premium", dutyName: "Premium 09/11", originalQueueName: "ALÉSSANDRA LEADS", offeredAt: new Date("2026-11-09T17:00:00.000Z") },
      { leadId: "afternoon-plus", brokerId: "b5", dutyScheduleId: "plus-pm", dutyName: "Plantão Plus - Tarde", originalQueueName: "Fila TATIANA", offeredAt: new Date("2026-11-09T17:30:00.000Z") },
      { leadId: "afternoon-no-schedule", brokerId: "b6", dutyScheduleId: null, dutyName: null, originalQueueName: null, offeredAt: new Date("2026-11-09T18:00:00.000Z") },
    ];

    expect(calculatePlantaoMetrics([], offers, DEFAULT_PLANTAO_REPORT_CONFIG).indications).toEqual({ morning: 2, afternoon: 2 });
  });

  it("arredonda cada média para cima e preserva zero", () => {
    const metrics: PlantaoReportMetrics = {
      generated: { total: 0 },
      external: { total: 0, details: null },
      internal: { total: 0, queues: [] },
      others: { total: 0, queues: [] },
      indications: { morning: 0, afternoon: 0 },
      quantity: { pme: 5.5, onlineMorning: 1.6, onlineAfternoon: 0, inPersonMorning: 0, inPersonAfternoon: 0 },
    };
    const text = buildPlantaoReportText(metrics, start);
    expect(text).toContain("PME 6 · Online 2/0 · Presencial 0/0");
    expect(text).not.toMatch(/\d,\d/);
  });

  it("usa zeros preenchidos e 0,0 quando não há ofertas aceitas", () => {
    const text = buildPlantaoReportText(calculatePlantaoMetrics([], [], DEFAULT_PLANTAO_REPORT_CONFIG), start);
    expect(text).toContain("*EXTERNO* · 0 leads");
    expect(text).toContain("PME 0 · Online 0/0 · Presencial 0/0");
  });
});
