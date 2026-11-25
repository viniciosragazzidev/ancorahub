import { describe, expect, it } from "vitest";

import {
  classifyCooling,
  formatIdle,
  lastActivityMs,
  lastContactLabel,
  noReplyStripe,
  returnInLabel,
  sortCoolingRows,
} from "./cooling-radar";

const now = new Date("2026-11-25T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const hoursAhead = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

describe("nível do radar Esfriando", () => {
  it("menos de 1 dia parado está em dia", () => {
    expect(classifyCooling({ status: "quote_sent", lastContactAt: hoursAgo(23) }, now)?.level).toBe("ok");
  });

  it("de 1 a 3 dias está em risco", () => {
    expect(classifyCooling({ status: "quote_sent", lastContactAt: hoursAgo(24) }, now)?.level).toBe("at_risk");
    expect(classifyCooling({ status: "negotiation", lastContactAt: hoursAgo(71) }, now)?.level).toBe("at_risk");
  });

  it("3 dias ou mais é crítico", () => {
    expect(classifyCooling({ status: "negotiation", lastContactAt: hoursAgo(72) }, now)?.level).toBe("critical");
    expect(classifyCooling({ status: "awaiting_reply", stageEnteredAt: hoursAgo(24 * 9) }, now)?.level).toBe("critical");
  });

  it("tarefa aberta com prazo futuro deixa o lead em voo, com os dias até o retorno", () => {
    const info = classifyCooling({ status: "quote_sent", lastContactAt: hoursAgo(24 * 5), nextOpenTaskDueAt: hoursAhead(30) }, now);
    expect(info).toMatchObject({ level: "in_flight", returnInDays: 2 });
    expect(returnInLabel(info!.returnInDays!)).toBe("Retorno em 2d");
    expect(classifyCooling({ status: "quote_sent", lastContactAt: hoursAgo(48), nextOpenTaskDueAt: hoursAhead(1) }, now)?.returnInDays).toBe(1);
  });

  it("tarefa com prazo vencido não conta como retorno marcado", () => {
    expect(classifyCooling({ status: "quote_sent", lastContactAt: hoursAgo(24 * 4), nextOpenTaskDueAt: hoursAgo(2) }, now)?.level).toBe("critical");
  });

  it("etapas fora do radar não entram", () => {
    for (const status of ["new", "under_analysis", "converted", "lost"]) {
      expect(classifyCooling({ status, lastContactAt: hoursAgo(24 * 10) }, now)).toBeNull();
    }
  });

  it("mede da atividade mais recente entre contato, etapa e atribuição", () => {
    expect(lastActivityMs({ status: "quote_sent", lastContactAt: hoursAgo(100), stageEnteredAt: hoursAgo(10) })).toBe(new Date(hoursAgo(10)).getTime());
    expect(lastActivityMs({ status: "quote_sent", createdAt: hoursAgo(50) })).toBe(new Date(hoursAgo(50)).getTime());
    expect(classifyCooling({ status: "quote_sent" }, now)).toBeNull();
  });
});

describe("ordem do radar", () => {
  it("do mais esquecido para o menos, em voo por último e em dia fora", () => {
    const rows = [
      { id: "risco", status: "quote_sent", lastContactAt: hoursAgo(30) },
      { id: "voo", status: "quote_sent", lastContactAt: hoursAgo(24 * 20), nextOpenTaskDueAt: hoursAhead(5) },
      { id: "critico", status: "negotiation", lastContactAt: hoursAgo(24 * 6) },
      { id: "dia", status: "negotiation", lastContactAt: hoursAgo(2) },
      { id: "critico-mais", status: "in_contact", lastContactAt: hoursAgo(24 * 12) },
    ];
    expect(sortCoolingRows(rows, (row) => classifyCooling(row, now)).map((item) => item.row.id)).toEqual(["critico-mais", "critico", "risco", "voo"]);
  });
});

describe("textos do cartão", () => {
  it("formata o tempo parado", () => {
    expect(formatIdle(5 * 60_000)).toBe("5 min");
    expect(formatIdle(5 * 60 * 60_000)).toBe("5 h");
    expect(formatIdle(30 * 60 * 60_000)).toBe("1 dia");
    expect(formatIdle(4 * 24 * 60 * 60_000)).toBe("4 dias");
  });

  it("faixa 'Sem resposta há X' só depois do SLA de parado e sem retorno marcado", () => {
    expect(noReplyStripe({ status: "quote_sent", lastContactAt: hoursAgo(24 * 2) }, 3, now)).toBeNull();
    expect(noReplyStripe({ status: "quote_sent", lastContactAt: hoursAgo(24 * 4) }, 3, now)).toBe("Sem resposta há 4 dias");
    expect(noReplyStripe({ status: "quote_sent", lastContactAt: hoursAgo(24 * 4), nextOpenTaskDueAt: hoursAhead(3) }, 3, now)).toBeNull();
    expect(noReplyStripe({ status: "converted", lastContactAt: hoursAgo(24 * 9) }, 3, now)).toBeNull();
  });

  it("tempo desde o último contato", () => {
    expect(lastContactLabel(hoursAgo(50), now)).toBe("há 2 dias");
    expect(lastContactLabel(null, now)).toBe("Sem contato ainda");
  });
});
