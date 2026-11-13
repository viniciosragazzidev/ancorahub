import { describe, expect, it } from "vitest";

import { biggestDrop, campaignRow, headline, QUESTION_LABELS, rankCounts } from "@/features/funnel-insights/insights-core";
import { noticeRecipientsKey } from "@/features/leads/closing-director-alert-core";
import { teamNoticeByKey } from "@/features/team-notices/catalog";
import { builtInNoticeVariants } from "@/features/team-notices/variants";

import { buildDailyLeadsReport, dailyLeadsReportKey, saoPauloDayStart, saoPauloHour, shortDate } from "./daily-leads-report-core";

describe("relatório das 18h", () => {
  it("uma linha por fila, mais leads primeiro, e o total", () => {
    const text = buildDailyLeadsReport([
      { queueName: "Familiar", leads: 8, hot: 2, warm: 3, cold: 3 },
      { queueName: "PME Rio", leads: 12, hot: 4, warm: 5, cold: 1 },
      { queueName: null, leads: 0, hot: 0, warm: 0, cold: 0 },
    ]);
    expect(text).toBe([
      "*PME Rio*: 12 leads · 🔥 4 quentes · 🌤️ 5 mornos · ❄️ 1 frio · 2 em qualificação",
      "*Familiar*: 8 leads · 🔥 2 quentes · 🌤️ 3 mornos · ❄️ 3 frios",
      "",
      "*Total*: 20 leads · 🔥 6 quentes · 🌤️ 8 mornos · ❄️ 4 frios · 2 em qualificação",
    ].join("\n"));
  });

  it("uma fila só não repete o total; sem leads diz que não entrou nenhum", () => {
    expect(buildDailyLeadsReport([{ queueName: null, leads: 1, hot: 1, warm: 0, cold: 0 }])).toBe("*Sem fila*: 1 lead · 🔥 1 quente · 🌤️ 0 mornos · ❄️ 0 frios");
    expect(buildDailyLeadsReport([])).toBe("Nenhum lead entrou hoje.");
  });

  it("dia e hora de São Paulo", () => {
    const at18 = new Date("2026-11-05T21:00:00Z");
    expect(saoPauloHour(at18)).toBe(18);
    expect(shortDate(at18)).toBe("05/11");
    expect(saoPauloDayStart(at18).toISOString()).toBe("2026-11-05T03:00:00.000Z");
    // 23h de SP ainda é o mesmo dia (02:00 UTC do dia seguinte).
    expect(shortDate(new Date("2026-11-06T02:00:00Z"))).toBe("05/11");
    expect(dailyLeadsReportKey("t1", "2026-11-05", "5521999990000")).toBe("daily-leads-report:t1:2026-11-05:5521999990000");
  });

  it("é um aviso da equipe com lista de números, fora do horário comercial", () => {
    const notice = teamNoticeByKey("DAILY_LEADS_REPORT");
    expect(notice).toMatchObject({ phoneRecipients: true, class: "any_day", defaultChannel: "company_number" });
    expect(noticeRecipientsKey("DAILY_LEADS_REPORT", "t1")).toBe("team_notice_recipients_DAILY_LEADS_REPORT_t1");
    // O fechamento continua na chave de sempre.
    expect(noticeRecipientsKey("LEAD_CLOSING_DIRECTOR", "t1")).toBe("closing_director_recipients_t1");
    const variants = builtInNoticeVariants({ purpose: "dailyLeadsReport", date: "05/11", report: "*PME*: 3 leads", link: null }, 18);
    expect(variants.length).toBeGreaterThan(1);
    expect(variants.every((text) => text.includes("05/11") && text.includes("*PME*: 3 leads"))).toBe(true);
  });
});

describe("funil profissional", () => {
  it("ordena e calcula a fatia de cada pergunta", () => {
    const rows = rankCounts(new Map([["age", 30], ["city", 10], ["email", 0]]), QUESTION_LABELS);
    expect(rows).toEqual([
      { key: "age", label: "Idades", count: 30, share: 0.75 },
      { key: "city", label: "Cidade", count: 10, share: 0.25 },
    ]);
  });

  it("acha a maior queda e escreve a frase", () => {
    const steps = [
      { key: "arrived", label: "Chegaram", count: 100 },
      { key: "replied", label: "Respondeu", count: 40 },
      { key: "qualified", label: "Qualificado", count: 30 },
    ];
    const drop = biggestDrop(steps);
    expect(drop?.from.key).toBe("arrived");
    expect(Math.round((drop?.lostShare ?? 0) * 100)).toBe(60);
    const topQuestion = rankCounts(new Map([["age", 6], ["city", 4]]), QUESTION_LABELS)[0];
    expect(headline({ drop, topQuestion, topLossStage: null })).toBe('Maior perda: 60% dos que param na qualificação param na pergunta "Idades".');
    expect(headline({ drop: biggestDrop([{ key: "a", label: "Com corretor", count: 10 }, { key: "b", label: "Venda", count: 2 }]), topQuestion: null, topLossStage: null }))
      .toBe('Maior perda: 80% dos leads não passam de "Com corretor" para "Venda".');
  });

  it("taxa por campanha e nome de quem não tem campanha", () => {
    expect(campaignRow({ key: "_none", name: null, leads: 10, qualified: 4, sales: 1 })).toEqual({ key: "_none", name: "Sem campanha", leads: 10, qualified: 4, sales: 1, qualifiedRate: 0.4, saleRate: 0.1 });
  });
});

describe("isSaoPauloWeekend (sem relatório no fim de semana)", () => {
  it("sábado e domingo em São Paulo, inclusive perto da meia-noite UTC", async () => {
    const { isSaoPauloWeekend } = await import("./daily-leads-report-core");
    expect(isSaoPauloWeekend(new Date("2026-11-07T21:00:00Z"))).toBe(true); // sábado 18h SP
    expect(isSaoPauloWeekend(new Date("2026-11-08T22:00:00Z"))).toBe(true); // domingo 19h SP
    expect(isSaoPauloWeekend(new Date("2026-11-09T22:00:00Z"))).toBe(false); // segunda 19h SP
    expect(isSaoPauloWeekend(new Date("2026-11-07T02:30:00Z"))).toBe(false); // sexta 23h30 SP
  });
});

describe("Resultado do Plantão cabe na variável do aviso (máx. 512)", () => {
  it("com números de 4 dígitos fica abaixo de 512 caracteres", async () => {
    const { buildPlantaoReportText } = await import("./plantao-report-core");
    const text = buildPlantaoReportText({
      generated: { total: 9999 },
      external: { total: 9999, details: { whatsapp: 9999, rd: 9999 } },
      internal: { total: 9999, queues: [{ name: "Fila PF - Renan", count: 9999 }, { name: "Fila PME - Renan", count: 9999 }, { name: "Whatsapp Renan", count: 9999 }], facebook: 9999, whatsapp: 9999 },
      others: { total: 9999, queues: [{ name: "Venâncio Leads", count: 9999 }, { name: "Alessandra Leads", count: 9999 }, { name: "Fila Extra Exemplo", count: 9999 }] },
      indications: { morning: 9999, afternoon: 9999 },
      quantity: { pme: 99.9, onlineMorning: 99.9, onlineAfternoon: 99.9, inPersonMorning: 99.9, inPersonAfternoon: 99.9 },
    }, new Date("2026-11-10T22:00:00Z"));
    expect(text.trim().length).toBeLessThanOrEqual(512);
  });
});
