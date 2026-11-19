import { describe, expect, it } from "vitest";

import { countCalls, periodStart, summarizeBrokers, wasAnswered, type CallAncoraCallRow } from "./report-rules";

const row = (id: string, overrides: Partial<CallAncoraCallRow> = {}): CallAncoraCallRow => ({
  id,
  brokerId: "b1",
  brokerName: "Ana",
  leadId: `lead-${id}`,
  leadName: "Lead",
  phoneMasked: "•••• ••00",
  outcome: "no_answer",
  auto: false,
  correction: false,
  talkSeconds: 0,
  causeLabel: null,
  assigned: false,
  at: `2026-11-19T12:00:0${id.length % 10}.000Z`,
  ...overrides,
});

describe("painel do Call Âncora", () => {
  it("atendeu = teve tempo em ligação ou foi classificada com ou sem interesse", () => {
    expect(wasAnswered({ talkSeconds: 0, outcome: "no_answer" })).toBe(false);
    expect(wasAnswered({ talkSeconds: 30, outcome: "voicemail" })).toBe(true);
    expect(wasAnswered({ talkSeconds: 0, outcome: "not_interested" })).toBe(true);
  });

  it("conta cada resultado e a correção substitui a ligação original", () => {
    const counts = countCalls([
      row("1", { outcome: "interested", talkSeconds: 60, at: "2026-11-19T12:00:00.000Z" }),
      row("2", { outcome: "no_answer", leadId: "x", at: "2026-11-19T12:01:00.000Z" }),
      row("3", { outcome: "voicemail", leadId: "y", at: "2026-11-19T12:02:00.000Z" }),
      row("4", { outcome: "not_interested", leadId: "y", correction: true, at: "2026-11-19T12:03:00.000Z" }),
      row("5", { outcome: "wrong_number", leadId: "z", at: "2026-11-19T12:04:00.000Z" }),
    ]);
    expect(counts).toEqual({ calls: 4, answered: 2, interested: 1, notInterested: 1, noAnswer: 1, voicemail: 0, wrongNumber: 1, talkSeconds: 60 });
  });

  it("corretores do mais recente para o mais antigo, com quem está em sessão", () => {
    const brokers = summarizeBrokers([
      row("1", { brokerId: "b1", brokerName: "Ana", at: "2026-11-19T10:00:00.000Z" }),
      row("2", { brokerId: "b2", brokerName: "Bruno", at: "2026-11-19T11:00:00.000Z" }),
      row("3", { brokerId: "b1", brokerName: "Ana", leadId: "outro", at: "2026-11-19T09:00:00.000Z" }),
    ], new Set(["b1"]));
    expect(brokers.map((broker) => [broker.brokerName, broker.calls, broker.inSessionNow])).toEqual([["Bruno", 1, false], ["Ana", 2, true]]);
    expect(brokers[1].lastCallAt).toBe("2026-11-19T10:00:00.000Z");
  });

  it("período começa à meia-noite de São Paulo", () => {
    const now = new Date("2026-11-19T15:00:00Z");
    expect(periodStart("today", now).toISOString()).toBe("2026-11-19T03:00:00.000Z");
    expect(periodStart("7d", now).toISOString()).toBe("2026-11-13T03:00:00.000Z");
  });
});
