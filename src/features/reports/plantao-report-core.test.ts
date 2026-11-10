import { describe, expect, it } from "vitest";

import {
  buildPlantaoReportText,
  calculatePlantaoMetrics,
  classifyPlantaoLead,
  DEFAULT_PLANTAO_REPORT_CONFIG,
  findPlantaoReportGroupId,
  parsePlantaoReportConfig,
  type PlantaoOfferRow,
  type PlantaoQueueRow,
  type PlantaoReportMetrics,
} from "./plantao-report-core";

const start = new Date("2026-11-09T12:00:00.000Z");

function offersFor(input: { prefix: string; count: number; brokers: number; name: string; schedule: string; time: string; originalQueueName?: string }): PlantaoOfferRow[] {
  return Array.from({ length: input.count }, (_, index) => ({
    leadId: `${input.prefix}-lead-${index}`,
    brokerId: `${input.prefix}-broker-${index % input.brokers}`,
    dutyScheduleId: input.schedule,
    dutyName: input.name,
    originalQueueName: input.originalQueueName ?? null,
    offeredAt: new Date(`${input.time.slice(0, 10)}T${input.time.slice(11)}Z`),
  }));
}

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

  it("reproduz os totais da conferência de 09/11 e monta o formato atualizado", () => {
    const queues: PlantaoQueueRow[] = [
      { queueName: "Fila TATIANA", kind: "whatsapp", count: 92 },
      { queueName: "Fila TATIANA", kind: "form", count: 27 },
      { queueName: "Fila PF - Renan", kind: "form", count: 60 },
      { queueName: "Fila PME - Renan", kind: "form", count: 58 },
      { queueName: "Whatsapp Renan", kind: "whatsapp", count: 17 },
      { queueName: null, kind: "other", count: 4 },
    ];
    const offers = [
      ...offersFor({ prefix: "pme", count: 19, brokers: 2, name: "PME Rio", schedule: "pme", time: "2026-11-09T09:00:00" }),
      ...offersFor({ prefix: "online-am", count: 21, brokers: 5, name: "Premium", schedule: "premium-am", time: "2026-11-09T10:00:00" }),
      ...offersFor({ prefix: "online-pm", count: 3, brokers: 3, name: "Premium", schedule: "premium-pm", time: "2026-11-09T17:00:00" }),
      ...offersFor({ prefix: "presencial-am", count: 13, brokers: 2, name: "Presencial 09/11 · Manhã", schedule: "presencial-am", time: "2026-11-09T11:00:00" }),
      ...offersFor({ prefix: "presencial-pm", count: 20, brokers: 3, name: "Presencial 09/11 · Tarde", schedule: "presencial-pm", time: "2026-11-09T17:00:00" }),
      ...offersFor({ prefix: "other-am", count: 33, brokers: 1, name: "Plantão Plus", schedule: "other-am", time: "2026-11-09T10:00:00" }),
      ...offersFor({ prefix: "other-pm", count: 25, brokers: 1, name: "Alessandra Leads", schedule: "other-pm", time: "2026-11-09T18:00:00", originalQueueName: "Alessandra Leads" }),
      ...offersFor({ prefix: "general-am", count: 29, brokers: 1, name: "Atendimento Geral", schedule: "general-am", time: "2026-11-09T11:00:00" }),
      ...offersFor({ prefix: "general-pm", count: 25, brokers: 1, name: "Atendimento Geral", schedule: "general-pm", time: "2026-11-09T18:00:00" }),
    ];
    const metrics = calculatePlantaoMetrics(queues, offers, DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(metrics).toEqual({
      external: { whatsapp: 92, rd: 27, total: 119 },
      internal: { facebook: 118, whatsapp: 17, total: 135 },
      indications: { morning: 82, afternoon: 48 },
      quantity: { pme: 9.5, onlineMorning: 4.2, onlineAfternoon: 1, inPersonMorning: 6.5, inPersonAfternoon: 20 / 3 },
    });
    expect(buildPlantaoReportText(metrics, new Date("2026-11-10T02:00:00.000Z"))).toBe([
      "📊 *Resultado do Plantão* · 09/11",
      "",
      "*EXTERNO* · 119 leads",
      "💬 WhatsApp Externo: 92",
      "📝 RD: 27",
      "",
      "*INTERNO* · 135 leads",
      "📘 Facebook: 118",
      "💬 WhatsApp Interno: 17",
      "",
      "*Indicações*",
      "🌅 Manhã: 82 · 🌇 Tarde: 48",
      "",
      "*Média de leads por corretor*",
      "🏢 PME: 10",
      "💻 Online: manhã 5 · tarde 1",
      "🧑‍💼 Presencial: manhã 7 · tarde 7",
    ].join("\n"));
    const text = buildPlantaoReportText(metrics, new Date("2026-11-10T02:00:00.000Z"));
    expect(text).not.toContain("Telefone");
    expect(text).not.toContain("WhatsApp Externo: 092");
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
      external: { whatsapp: 0, rd: 0, total: 0 },
      internal: { facebook: 0, whatsapp: 0, total: 0 },
      indications: { morning: 0, afternoon: 0 },
      quantity: { pme: 5.5, onlineMorning: 1.6, onlineAfternoon: 0, inPersonMorning: 0, inPersonAfternoon: 0 },
    };
    const text = buildPlantaoReportText(metrics, start);
    expect(text).toContain("🏢 PME: 6");
    expect(text).toContain("💻 Online: manhã 2 · tarde 0");
    expect(text).toContain("🧑‍💼 Presencial: manhã 0 · tarde 0");
    expect(text).not.toContain(",");
  });

  it("usa zeros preenchidos e 0,0 quando não há ofertas aceitas", () => {
    const text = buildPlantaoReportText(calculatePlantaoMetrics([], [], DEFAULT_PLANTAO_REPORT_CONFIG), start);
    expect(text).toContain("📊 *Resultado do Plantão* · 09/11");
    expect(text).toContain("*EXTERNO* · 0 leads");
    expect(text).toContain("🏢 PME: 0");
    expect(text).toContain("💻 Online: manhã 0 · tarde 0");
    expect(text).toContain("🧑‍💼 Presencial: manhã 0 · tarde 0");
  });
});
