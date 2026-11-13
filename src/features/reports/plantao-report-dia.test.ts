import { describe, expect, it } from "vitest";
import {
  buildPlantaoReportText,
  calculatePlantaoMetrics,
  DEFAULT_PLANTAO_REPORT_CONFIG,
  plantaoReportTitle,
  plantaoReportWindow,
  plantaoSendsOn,
  type PlantaoQueueRow,
} from "./plantao-report-core";

// Envio às 19h SP = 22h UTC. São Paulo é UTC-3 o ano todo.
const envio = (dia: string) => new Date(`${dia}T22:00:00Z`);

describe("janela: ontem 19h → hoje 19h (igual à tela de Qualidade), enviada às 19h", () => {
  it("terça 10/11 19h cobre seg 09/11 19h → ter 10/11 19h", () => {
    const w = plantaoReportWindow(envio("2026-11-10"));
    expect(w.reportedDayKey).toBe("2026-11-10");
    expect(w.since.toISOString()).toBe("2026-11-09T22:00:00.000Z");
    expect(w.until.toISOString()).toBe("2026-11-10T22:00:00.000Z");
  });

  it("segunda 16/11 19h cobre sexta 13/11 19h → segunda 16/11 19h (fim de semana entra na janela da segunda)", () => {
    const w = plantaoReportWindow(envio("2026-11-16"));
    expect(w.since.toISOString()).toBe("2026-11-13T22:00:00.000Z");
    expect(w.until.toISOString()).toBe("2026-11-16T22:00:00.000Z");
  });

  it("janelas consecutivas não se sobrepõem nem deixam buraco", () => {
    const terca = plantaoReportWindow(envio("2026-11-10"));
    const quarta = plantaoReportWindow(envio("2026-11-11"));
    expect(quarta.since.getTime()).toBe(terca.until.getTime());
  });

  it("sábado e domingo não são enviados; de segunda a sexta sim", () => {
    expect(plantaoSendsOn(envio("2026-11-14"))).toBe(false); // sábado
    expect(plantaoSendsOn(envio("2026-11-15"))).toBe(false); // domingo
    expect(plantaoSendsOn(envio("2026-11-16"))).toBe(true); // segunda
    expect(plantaoSendsOn(envio("2026-11-13"))).toBe(true); // sexta
  });
});

describe("título com o período coberto", () => {
  it("Resultado do plantão · 12/11 (11/11 19h → 12/11 19h)", () => {
    expect(plantaoReportTitle("2026-11-12")).toBe("Resultado do plantão · 12/11 (11/11 19h → 12/11 19h)");
  });

  it("segunda: Resultado do plantão · 16/11 (13/11 19h → 16/11 19h)", () => {
    expect(plantaoReportTitle("2026-11-16")).toBe("Resultado do plantão · 16/11 (13/11 19h → 16/11 19h)");
  });
});

// Números por fila de entrada, 19h→19h, iguais à tela de Qualidade em produção.
const dia10 = (): PlantaoQueueRow[] => [
  { queueName: "FILA TATIANA", kind: "whatsapp", count: 125 },
  { queueName: "FILA PF - RENAN", kind: "form", count: 56 },
  { queueName: "FILA PME - RENAN", kind: "form", count: 30 },
  { queueName: "Whatsapp Renan", kind: "whatsapp", count: 24 },
  { queueName: "Venâncio Leads", kind: "form", count: 8 },
  { queueName: "Alessandra Leads", kind: "whatsapp", count: 3 },
];

describe("linhas por fila de entrada, iguais à tela de Qualidade", () => {
  it("10/11: Tatiana 125, Interno 110 (56+30+24), Outras 11, Total 246", () => {
    const m = calculatePlantaoMetrics(dia10(), [], DEFAULT_PLANTAO_REPORT_CONFIG);
    expect(m.generated.total).toBe(246);
    expect(m.external.total).toBe(125);
    expect(m.internal.total).toBe(110);
    expect(m.internal.queues.map((q) => q.count)).toEqual([56, 30, 24]);
    expect(m.others.total).toBe(11);
    expect(m.external.total + m.internal.total + m.others.total).toBe(m.generated.total);
  });

  it("11/11: Tatiana 105, Interno 113 (71+34+8), Outras 9, Total 227", () => {
    const rows: PlantaoQueueRow[] = [
      { queueName: "FILA TATIANA", kind: "whatsapp", count: 105 },
      { queueName: "FILA PF - RENAN", kind: "form", count: 71 },
      { queueName: "FILA PME - RENAN", kind: "form", count: 34 },
      { queueName: "Whatsapp Renan", kind: "whatsapp", count: 8 },
      { queueName: "Venâncio Leads", kind: "form", count: 5 },
      { queueName: "Alessandra Leads", kind: "whatsapp", count: 4 },
    ];
    const m = calculatePlantaoMetrics(rows, [], DEFAULT_PLANTAO_REPORT_CONFIG);
    expect([m.external.total, m.internal.total, m.others.total, m.generated.total]).toEqual([105, 113, 9, 227]);
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

  it("o texto segue o formato de 11/11: seções separadas, sem outras filas, Manhã/Tarde escritos e PREMIUM", () => {
    const m = calculatePlantaoMetrics(dia10(), [], DEFAULT_PLANTAO_REPORT_CONFIG);
    const text = buildPlantaoReportText(m, envio("2026-11-10"));
    expect(text.startsWith("📊 *Resultado do Plantão* · 10/11\n\n*EXTERNO* · 125 leads")).toBe(true);
    expect(text).toContain("\n\n*INTERNO* · 110 leads\n📘 Facebook: ");
    expect(text).toContain("💬 WhatsApp Interno: ");
    expect(text).toContain("\n\n*Indicações*\n🌅 Manhã: ");
    expect(text).toContain("🌇 Tarde: ");
    expect(text).toContain("\n\n*Média de leads por corretor*\n🏢 PME: ");
    expect(text).toContain("💻 PREMIUM: manhã ");
    expect(text).not.toMatch(/Outras filas|Total gerado|Venâncio|Alessandra|Online/i);
    expect(m.internal.facebook + m.internal.whatsapp).toBe(110);
  });
});
