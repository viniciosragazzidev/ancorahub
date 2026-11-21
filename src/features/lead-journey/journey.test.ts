import { describe, expect, it } from "vitest";

import { deriveLeadJourney, journeyTitle, JOURNEY_TOTAL } from "./journey";

const now = new Date("2026-11-21T17:00:00Z"); // 14:00 em São Paulo
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

describe("deriveLeadJourney", () => {
  it("Q1: chegou e a IA ainda não escreveu", () => {
    const journey = deriveLeadJourney({ now, status: "new" });
    expect(journey.code).toBe("Q1");
    expect(journey.step).toBe(1);
    expect(journey.total).toBe(JOURNEY_TOTAL);
  });

  it("Q2: contatado, sem resposta e sem lembrete ainda", () => {
    const journey = deriveLeadJourney({ now, status: "new", aiFirstContactAt: ago(10), cadence: { sent: 0, total: 6, nextAt: new Date(now.getTime() + 10 * 60_000) } });
    expect(journey.code).toBe("Q2");
    expect(journey.nextStep).toBe("Lembrete 1 de 6 às 14:10");
  });

  it("R1: nunca respondeu e já recebeu lembrete", () => {
    const journey = deriveLeadJourney({ now, status: "new", aiFirstContactAt: ago(300), cadence: { sent: 2, total: 6 } });
    expect(journey.code).toBe("R1");
    expect(journey.phase).toBe("recuperacao");
    expect(journey.detail).toBe("2 de 6 lembretes");
  });

  it("R1 no fim dos lembretes aponta para a fila de ligação", () => {
    expect(deriveLeadJourney({ now, status: "new", qualificationStatus: "cold", aiFirstContactAt: ago(5000), cadence: { sent: 6, total: 6 } }).nextStep).toContain("fila de ligação");
  });

  it("Q3: em conversa, com o próximo campo como subpasso", () => {
    const journey = deriveLeadJourney({ now, status: "new", qualificationStatus: "qualifying", aiFirstContactAt: ago(30), lastInboundAt: ago(3), inboundCount: 2, lastAiMessageAt: ago(2), collectedFields: ["planType", "numberOfLives"] });
    expect(journey.code).toBe("Q3");
    expect(journeyTitle(journey)).toBe("Em conversa · Idades");
    expect(journey.nextStep).toBe("Cliente responde: idades");
  });

  it("R2: respondeu e virou frio no meio", () => {
    const journey = deriveLeadJourney({ now, status: "new", qualificationStatus: "cold", aiFirstContactAt: ago(200), lastInboundAt: ago(150), inboundCount: 1, lastAiMessageAt: ago(120), collectedFields: ["planType"] });
    expect(journey.code).toBe("R2");
    expect(journey.detail).toBe("Vidas");
    expect(journey.reason).toBe("Parou de responder há 2 h");
  });

  it("R3: morno", () => {
    expect(deriveLeadJourney({ now, status: "new", qualificationStatus: "warm", aiFirstContactAt: ago(60), inboundCount: 3 }).code).toBe("R3");
  });

  it("Q4 e Q5: quente, fora e dentro da fila", () => {
    expect(deriveLeadJourney({ now, status: "new", qualificationStatus: "hot", distributionStatus: "manual_hold" }).code).toBe("Q4");
    expect(deriveLeadJourney({ now, status: "new", qualificationStatus: "qualified", distributionStatus: "queued" }).code).toBe("Q5");
  });

  it("N1 com primeiro contato atrasado", () => {
    const journey = deriveLeadJourney({ now, status: "distributed", corretorId: "c1", qualificationStatus: "hot", assignedAt: ago(27), firstContactSlaMinutes: 15 });
    expect(journey.code).toBe("N1");
    expect(journey.nextStep).toBe("Corretor: 1º contato atrasado 12 min");
    expect(journey.tone).toBe("pending");
  });

  it("negociação segue o status do lead", () => {
    expect(deriveLeadJourney({ now, status: "quote_sent", corretorId: "c1" }).code).toBe("N2");
    expect(deriveLeadJourney({ now, status: "under_analysis", corretorId: "c1" }).step).toBe(10);
    expect(deriveLeadJourney({ now, status: "converted", corretorId: "c1" }).step).toBe(JOURNEY_TOTAL);
  });

  it("X1 vale por cima de tudo menos ganho e perdido", () => {
    expect(deriveLeadJourney({ now, status: "new", qualificationStatus: "hot", optedOut: true }).code).toBe("X1");
    expect(deriveLeadJourney({ now, status: "new", wrongNumber: true }).reason).toBe("Número errado");
  });

  it("marcas da recuperação", () => {
    expect(deriveLeadJourney({ now, status: "new", qualificationStatus: "cold", recovery: { state: "call_queue" } }).code).toBe("R4");
    expect(deriveLeadJourney({ now, status: "new", recovery: { state: "bad_moment", until: "2026-12-21T13:00:00Z" } }).nextStep).toBe("Próximo contato em 21/12");
  });

  it("sem WhatsApp", () => {
    expect(deriveLeadJourney({ now, status: "new", hasWhatsapp: false }).code).toBe("SW");
  });
});
