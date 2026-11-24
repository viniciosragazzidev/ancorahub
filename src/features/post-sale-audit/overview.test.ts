import { describe, expect, it } from "vitest";

import {
  EMPTY_POST_SALE_FILTERS,
  filterPostSaleSurveys,
  postSaleByBroker,
  postSaleByDay,
  postSaleByRule,
  postSaleFunnel,
  postSaleStage,
  postSaleSurveysCsv,
  summarizePostSaleSurveys,
  type PostSaleSurveyRow,
} from "./overview";

const AT = "2026-11-24T13:00:00.000Z";

function row(overrides: Partial<PostSaleSurveyRow>): PostSaleSurveyRow {
  return { id: "s", leadId: "l", leadName: "Lead", brokerId: "b1", brokerName: "Ana", campaignId: "c", campaignName: "R1", ruleKey: "R1", status: "sent", outcome: null, rating: null, answers: {}, skipReason: null, createdAt: AT, sentAt: AT, deliveredAt: null, readAt: null, lastReplyAt: null, completedAt: null, alertOpen: false, ...overrides };
}

const rows = [
  row({ id: "1", leadId: "l1", status: "completed", rating: 5, answers: { contacted: true }, deliveredAt: AT, readAt: AT, lastReplyAt: AT }),
  row({ id: "2", leadId: "l2", status: "answering", answers: { contacted: false }, lastReplyAt: AT, alertOpen: true }),
  row({ id: "3", leadId: "l3", status: "sent", deliveredAt: AT }),
  row({ id: "4", leadId: "l4", status: "opted_out", brokerId: "b2", brokerName: "Bia", ruleKey: null, lastReplyAt: AT }),
  row({ id: "5", leadId: "l5", status: "failed", sentAt: null, ruleKey: "R0" }),
  row({ id: "6", leadId: "l6", status: "queued", sentAt: null }),
];

describe("situação da pesquisa", () => {
  it("separa fila, falha, aguardando, em andamento e concluída", () => {
    expect(postSaleStage(row({ status: "queued", sentAt: null }))).toBe("queued");
    expect(postSaleStage(row({ status: "sent" }))).toBe("waiting");
    expect(postSaleStage(row({ status: "sent", lastReplyAt: AT }))).toBe("in_progress");
    expect(postSaleStage(row({ status: "no_reply" }))).toBe("no_reply");
    expect(postSaleStage(row({ status: "skipped" }))).toBe("skipped");
    expect(postSaleStage(row({ status: "opted_out" }))).toBe("opted_out");
  });
});

describe("números do período", () => {
  it("conta envio, entrega, leitura e resposta (resposta conta como entregue e lida)", () => {
    const summary = summarizePostSaleSurveys(rows);
    expect(summary).toMatchObject({ total: 6, sent: 4, delivered: 4, read: 3, responded: 3, inProgress: 1, completed: 1, noReply: 1, optedOut: 1, failed: 1, queued: 1, averageRating: 5, openAlerts: 1, responseRate: 75 });
    expect(postSaleFunnel(summary).map((step) => [step.id, step.value, step.percent])).toEqual([
      ["sent", 4, 100], ["delivered", 4, 100], ["read", 3, 75], ["responded", 3, 75], ["completed", 1, 25],
    ]);
  });

  it("agrupa por regra na ordem R0, R1..R5, Manual", () => {
    expect(postSaleByRule(rows).map((item) => [item.key, item.sent, item.responded, item.failed])).toEqual([
      ["R0", 0, 0, 1], ["R1", 3, 2, 0], ["manual", 1, 1, 0],
    ]);
  });

  it("preenche os dias vazios e conta pelo dia do envio em São Paulo", () => {
    const days = postSaleByDay(rows, 3, new Date("2026-11-24T20:00:00.000Z"));
    expect(days).toEqual([
      { day: "2026-11-22", sent: 0, responded: 0 },
      { day: "2026-11-23", sent: 0, responded: 0 },
      { day: "2026-11-24", sent: 4, responded: 3 },
    ]);
  });

  it("resume cada corretor com alerta primeiro e o falou com o cliente", () => {
    const [ana, bia] = postSaleByBroker(rows);
    expect(ana).toMatchObject({ brokerId: "b1", leads: 5, sent: 3, responded: 2, contactedYes: 1, contactedAnswered: 2, contactedPercent: 50, noContact: 1, openAlerts: 1, failed: 1, averageRating: 5 });
    expect(bia).toMatchObject({ brokerId: "b2", sent: 1, responded: 1 });
  });
});

describe("filtros e exportação", () => {
  it("filtra por regra, situação, corretor e dia", () => {
    const ids = (filters: Partial<typeof EMPTY_POST_SALE_FILTERS>) => filterPostSaleSurveys(rows, { ...EMPTY_POST_SALE_FILTERS, ...filters }).map((item) => item.id);
    expect(ids({ rule: "manual" })).toEqual(["4"]);
    expect(ids({ stage: "responded" })).toEqual(["1", "2", "4"]);
    expect(ids({ stage: "failed" })).toEqual(["5"]);
    expect(ids({ brokerId: "b2" })).toEqual(["4"]);
    expect(ids({ day: "2026-11-24" })).toEqual(["1", "2", "3", "4"]);
    expect(ids({ day: "2026-11-23" })).toEqual([]);
  });

  it("gera CSV com ponto e vírgula e aspas quando precisa", () => {
    const csv = postSaleSurveysCsv([row({ leadName: "Ana; Souza", status: "completed", rating: 4, answers: { contacted: true, comment: "Ótimo \"atendimento\"" }, lastReplyAt: AT })]);
    const [header, line] = csv.split("\r\n");
    expect(header).toBe("Lead;Corretor;Origem;Situação;Enviada em;Respondeu em;Nota;Falou com o cliente;Resumo;Comentário");
    expect(line).toContain("\"Ana; Souza\";Ana;R1 Checagem de atendimento;Concluída;");
    expect(line).toContain(";4;Sim;");
    expect(line).toContain("\"Ótimo \"\"atendimento\"\"\"");
  });
});
