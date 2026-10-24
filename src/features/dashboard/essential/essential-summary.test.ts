import { describe, expect, it } from "vitest";

import { dutyStartsAt, summarizeDuties, summarizeQueues, summarizeWhatsApp } from "./essential-summary";

describe("fila: entraram, temperatura e requalificação", () => {
  it("fecha a conta: quentes, mornos, frios e em qualificação somam o que entrou", () => {
    const { queues, totals } = summarizeQueues(
      [
        { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "hot", leads: 4 },
        { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "warm", leads: 3 },
        { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "cold", leads: 2 },
        { queueId: "tatiana", queueName: "Fila Tatiana", hue: 210, status: "pending", leads: 5 },
      ],
      [],
      [],
    );
    const tatiana = queues[0]!;
    expect(tatiana.arrived).toBe(14);
    expect(tatiana.hot + tatiana.warm + tatiana.cold + tatiana.inQualification).toBe(tatiana.arrived);
    expect(tatiana.qualified).toBe(7);
    expect(tatiana.inQualification).toBe(5);
    expect(totals.arrived).toBe(14);
  });

  it("conta quantos frios tiveram 1, 2 ou 3+ tentativas e o total de tentativas", () => {
    const { queues } = summarizeQueues(
      [{ queueId: "pf", queueName: "PF Renan", hue: 30, status: "cold", leads: 4 }],
      [],
      [
        { queueId: "pf", attempts: 1 },
        { queueId: "pf", attempts: 2 },
        { queueId: "pf", attempts: 3 },
        { queueId: "pf", attempts: 5 },
        { queueId: "pf", attempts: 0 },
      ],
    );
    expect(queues[0]!.requalification).toEqual({ coldLeads: 5, attempts: 11, once: 1, twice: 1, threePlus: 2 });
  });

  it("lead sem fila vai para 'Sem fila'; sem leads não há fila nenhuma", () => {
    const { queues } = summarizeQueues([{ queueId: null, queueName: null, hue: null, status: null, leads: 2 }], [], []);
    expect(queues).toHaveLength(1);
    expect(queues[0]!.name).toBe("Sem fila");
    expect(queues[0]!.inQualification).toBe(2);
    expect(summarizeQueues([], [], []).queues).toEqual([]);
  });
});

describe("plantões agora", () => {
  const duty = { scheduleId: "s1", name: "Plantão Tatiana", startsAt: "08:00", endsAt: "19:00", queueId: "tatiana", minimumBrokers: 3, brokerCount: 4 };

  it("mostra leads disponíveis, distribuídos desde o início do plantão e corretores confirmados", () => {
    const [result] = summarizeDuties([duty], new Map([["tatiana", 6]]), new Map([["s1", 9]]), new Map([["s1", 2]]));
    expect(result).toMatchObject({ available: 6, distributed: 9, activeBrokers: 2, brokerCount: 4, belowMinimum: true });
  });

  it("sem fila ligada ao plantão, os leads disponíveis ficam em zero", () => {
    const [result] = summarizeDuties([{ ...duty, queueId: null }], new Map([["tatiana", 6]]), new Map(), new Map());
    expect(result).toMatchObject({ available: 0, distributed: 0, activeBrokers: 0 });
  });

  it("sem plantão ativo, a lista fica vazia", () => {
    expect(summarizeDuties([], new Map(), new Map(), new Map())).toEqual([]);
  });

  it("o início do plantão é o horário de São Paulo do dia do plantão (UTC-3)", () => {
    expect(dutyStartsAt("2026-10-24", "08:00").toISOString()).toBe("2026-10-24T11:00:00.000Z");
    expect(dutyStartsAt("2026-10-24", "19:30:00").toISOString()).toBe("2026-10-24T22:30:00.000Z");
  });
});

describe("corretores e WhatsApp", () => {
  it("corretor sem conexão não entra nas contas de recebidos e respondendo", () => {
    const result = summarizeWhatsApp([
      { id: "a", name: "Ana", connected: true, received: 20, responding: 8, active: 5 },
      { id: "b", name: "Bruno", connected: false, received: 30, responding: 30, active: 9 },
    ]);
    expect(result).toMatchObject({ total: 2, connected: 1, received: 20, responding: 8, active: 5, responseRate: 40 });
    expect(result.brokers.map((broker) => broker.id)).toEqual(["a"]);
  });

  it("sem recebidos, a taxa é zero (não divide por zero)", () => {
    expect(summarizeWhatsApp([{ id: "a", name: "Ana", connected: true, received: 0, responding: 0, active: 0 }]).responseRate).toBe(0);
    expect(summarizeWhatsApp([]).responseRate).toBe(0);
  });

  it("ordena por atendimentos ativos e depois pelo nome", () => {
    const result = summarizeWhatsApp([
      { id: "c", name: "Carla", connected: true, received: 1, responding: 1, active: 2 },
      { id: "a", name: "Ana", connected: true, received: 1, responding: 1, active: 5 },
      { id: "b", name: "Bia", connected: true, received: 1, responding: 1, active: 2 },
    ]);
    expect(result.brokers.map((broker) => broker.name)).toEqual(["Ana", "Bia", "Carla"]);
  });
});
