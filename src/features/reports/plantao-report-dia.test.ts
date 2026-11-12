import { describe, expect, it } from "vitest";
import {
  buildPlantaoReportText,
  calculatePlantaoMetrics,
  DEFAULT_PLANTAO_REPORT_CONFIG,
  plantaoReportTitleDay,
  plantaoReportWindow,
  type PlantaoQueueRow,
} from "./plantao-report-core";

// São Paulo é UTC-3 o ano todo. Envio às 08h SP = 11h UTC.
const envio = (dia: string) => new Date(`${dia}T11:00:00Z`);

describe("dia relatado: dia anterior de calendário (00h-23h59 SP)", () => {
  it("terça 08h relata a segunda inteira", () => {
    const w = plantaoReportWindow(envio("2026-11-10")); // ter 08h → relata seg 09/11
    expect(w.reportedDayKey).toBe("2026-11-09");
    expect(w.since.toISOString()).toBe("2026-11-09T03:00:00.000Z");
    expect(w.until.toISOString()).toBe("2026-11-10T03:00:00.000Z");
  });

  it("segunda 08h relata o domingo (fim de semana também é relatado)", () => {
    expect(plantaoReportWindow(envio("2026-11-16")).reportedDayKey).toBe("2026-11-15");
  });

  it("sábado 08h relata sexta, e domingo 08h relata sábado", () => {
    expect(plantaoReportWindow(envio("2026-11-14")).reportedDayKey).toBe("2026-11-13");
    expect(plantaoReportWindow(envio("2026-11-15")).reportedDayKey).toBe("2026-11-14");
  });

  it("título com a data do dia relatado", () => {
    expect(plantaoReportTitleDay("2026-11-10")).toBe("terça, 10/11");
    expect(plantaoReportTitleDay("2026-11-15")).toBe("domingo, 15/11");
  });
});

// Filas de entrada do dia (00-24, calendário), iguais à tela de Qualidade em produção.
const dia10 = (): PlantaoQueueRow[] => [
  { queueName: "FILA TATIANA", kind: "whatsapp", count: 124 },
  { queueName: "FILA PF - RENAN", kind: "form", count: 49 },
  { queueName: "FILA PME - RENAN", kind: "form", count: 27 },
  { queueName: "Whatsapp Renan", kind: "whatsapp", count: 27 },
  { queueName: "Venâncio Leads", kind: "form", count: 8 },
  { queueName: "Alessandra Leads", kind: "whatsapp", count: 4 },
];

describe("linhas do relatório por fila de entrada (10/11 = tela de Qualidade)", () => {
  it("10/11: Tatiana 124, Interno 103 (49+27+27), Outras 12, Total 239", () => {
    const m = calculatePlantaoMetrics(dia10(), [], DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(m.generated.total).toBe(239);
    expect(m.external.total).toBe(124);
    expect(m.internal.total).toBe(103);
    expect(m.internal.queues.map((q) => q.count)).toEqual([49, 27, 27]);
    expect(m.others.total).toBe(12);
    expect(m.external.total + m.internal.total + m.others.total).toBe(m.generated.total);
  });

  it("11/11 (00-24): Tatiana 103, Interno 139 (89+47+3), Outras 9, Total 251", () => {
    const rows: PlantaoQueueRow[] = [
      { queueName: "FILA TATIANA", kind: "whatsapp", count: 103 },
      { queueName: "FILA PF - RENAN", kind: "form", count: 89 },
      { queueName: "FILA PME - RENAN", kind: "form", count: 47 },
      { queueName: "Whatsapp Renan", kind: "whatsapp", count: 3 },
      { queueName: "Venâncio Leads", kind: "form", count: 5 },
      { queueName: "Alessandra Leads", kind: "whatsapp", count: 4 },
    ];
    const m = calculatePlantaoMetrics(rows, [], DEFAULT_PLANTAO_REPORT_CONFIG);
    expect([m.external.total, m.internal.total, m.others.total, m.generated.total]).toEqual([103, 139, 9, 251]);
  });

  it("detalhe WhatsApp/RD da Tatiana só aparece se somar o total da fila", () => {
    const soma = calculatePlantaoMetrics([
      { queueName: "FILA TATIANA", kind: "whatsapp", count: 10 },
      { queueName: "FILA TATIANA", kind: "form", count: 5 },
    ], [], DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(soma.external.details).toEqual({ whatsapp: 10, rd: 5 });
    const naoSoma = calculatePlantaoMetrics([
      { queueName: "FILA TATIANA", kind: "whatsapp", count: 10 },
      { queueName: "FILA TATIANA", kind: "other", count: 2 },
    ], [], DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(naoSoma.external.details).toBeNull();
  });

  it("o texto mostra título, período, total, filas e outras filas", () => {
    const m = calculatePlantaoMetrics(dia10(), [], DEFAULT_PLANTAO_REPORT_CONFIG);
    const text = buildPlantaoReportText(m, envio("2026-11-11")); // envio de 11/11 relata 10/11
    expect(text).toContain("📊 *Resultado de terça, 10/11* · 00h às 23h59 de 10/11");
    expect(text).toContain("*Total gerado* · 239 leads");
    expect(text).toContain("*EXTERNO* · 124 leads");
    expect(text).toContain("*INTERNO* · 103 leads");
    expect(text).toContain("*Outras filas* · 12 leads");
  });
});
