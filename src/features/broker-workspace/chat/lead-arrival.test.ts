import { describe, expect, it } from "vitest";

import { arrivalView, nextStepFor } from "./lead-arrival";

// 17/10/2026 15:00 em São Paulo.
const NOW = new Date("2026-10-17T18:00:00.000Z");

describe("arrivalView: quando o lead chegou", () => {
  it("says today with the hour and the plantão of origin", () => {
    const view = arrivalView({ arrivedAt: new Date("2026-10-17T17:32:00.000Z"), now: NOW, dutyName: "PRESENCIAL TARDE" });

    expect(view).toEqual({ text: "Recebido por você hoje às 14:32 · Plantão PRESENCIAL TARDE", stale: false });
  });

  it("says who it was distributed to when a supervisor or gestor looks", () => {
    const view = arrivalView({ arrivedAt: new Date("2026-10-17T17:32:00.000Z"), now: NOW, viewer: "management", ownerName: "Ana" });

    expect(view.text).toBe("Distribuído para Ana hoje às 14:32");
  });

  it("says yesterday and flags it as not today", () => {
    const view = arrivalView({ arrivedAt: new Date("2026-10-16T20:05:00.000Z"), now: NOW });

    expect(view).toEqual({ text: "Recebido por você ontem às 17:05", stale: true });
  });

  it("shows the date and the days ago for an older lead, so it is not mistaken for today's", () => {
    const view = arrivalView({ arrivedAt: new Date("2026-10-14T17:32:00.000Z"), now: NOW, dutyName: "PRESENCIAL MANHÃ" });

    expect(view).toEqual({ text: "Recebido por você em 14/10, há 3 dias · Plantão PRESENCIAL MANHÃ", stale: true });
  });

  it("uses the São Paulo day, not UTC, so 22h local is still today", () => {
    // 17/10 22:30 em São Paulo = 18/10 01:30 UTC.
    const view = arrivalView({ arrivedAt: new Date("2026-10-18T01:30:00.000Z"), now: new Date("2026-10-18T01:45:00.000Z") });

    expect(view.text).toBe("Recebido por você hoje às 22:30");
  });
});

describe("nextStepFor: o único passo que o corretor precisa dar agora", () => {
  const base = { owned: true, accepted: true, closed: false, lastClientAt: null, lastBrokerAt: null, nextAction: null, now: NOW } as const;

  it("asks to accept first, before anything else", () => {
    expect(nextStepFor({ ...base, accepted: false })).toMatchObject({ kind: "accept", tone: "urgent" });
  });

  it("says the client replied and waits, without when, when the broker has not answered", () => {
    const step = nextStepFor({ ...base, lastClientAt: new Date("2026-10-17T17:55:00.000Z"), lastBrokerAt: new Date("2026-10-17T17:00:00.000Z") });

    expect(step).toMatchObject({ kind: "reply", title: "Responder o cliente", detail: "O cliente respondeu e espera sua resposta." });
  });

  it("says the broker has not called yet when there is no outgoing message", () => {
    expect(nextStepFor({ ...base })).toMatchObject({ kind: "whatsapp", title: "Você ainda não chamou o cliente" });
  });

  it("does not ask to reply when the broker answered after the client", () => {
    const step = nextStepFor({ ...base, lastClientAt: new Date("2026-10-17T17:00:00.000Z"), lastBrokerAt: new Date("2026-10-17T17:10:00.000Z") });

    expect(step.kind).not.toBe("reply");
  });

  it("uses the AI suggestion when nothing is waiting on the broker", () => {
    const step = nextStepFor({ ...base, lastBrokerAt: new Date("2026-10-17T17:10:00.000Z"), nextAction: "Mandar a cotação PME" });

    expect(step).toMatchObject({ title: "Mandar a cotação PME", detail: "Sugestão da IA." });
  });

  it("is done for a closed lead, and says the lead belongs to another broker", () => {
    expect(nextStepFor({ ...base, closed: true })).toMatchObject({ kind: "closed", tone: "done" });
    expect(nextStepFor({ ...base, owned: false })).toMatchObject({ kind: "none", title: "Este lead está com outro corretor" });
  });

  it("phrases the same moment for the supervisor, who cannot act on the chat", () => {
    const step = nextStepFor({ ...base, viewer: "management", ownerName: "Maria", lastClientAt: new Date("2026-10-17T17:55:00.000Z"), lastBrokerAt: null });

    expect(step).toMatchObject({ kind: "wait", title: "Cliente aguardando resposta", detail: "Respondeu há 5 min. Maria ainda não respondeu." });
  });
});
