import { describe, expect, it } from "vitest";

import { companyChatUnavailableMessage, getDirectorFacingMetaDeliveryFailure, initialMessageFailureNote } from "./meta-delivery-failure";

describe("getDirectorFacingMetaDeliveryFailure", () => {
  it("explica com segurança o bloqueio de cobrança da WABA", () => {
    expect(getDirectorFacingMetaDeliveryFailure("131042")).toEqual({
      code: "131042",
      title: "Cobrança da conta WhatsApp pendente",
      message:
        "A Meta bloqueou a entrega porque a conta WhatsApp Business está com uma pendência de cobrança ou elegibilidade. Revise o método de pagamento vinculado à WABA no Meta Business Suite.",
    });
  });
});

describe("falha da primeira mensagem do atendimento virtual", () => {
  it("explica o limite da Meta por contato (131049)", () => {
    expect(getDirectorFacingMetaDeliveryFailure("131049")?.title).toBe("Meta limitou mensagens para este contato");
  });

  it("registra no lead o motivo e que ele vai para um corretor, sem chamar de desqualificado", () => {
    const note = initialMessageFailureNote("131026");
    expect(note).toContain("Motivo (131026): Mensagem não pôde ser entregue.");
    expect(note).toContain("Sem contato no WhatsApp");
    expect(note).not.toMatch(/desqualificad/i);
    expect(initialMessageFailureNote(null)).not.toContain("Motivo");
  });
});

describe("chat com corretor pelo WhatsApp da empresa indisponível", () => {
  it("diz até quando o número está pausado, no horário de Brasília", () => {
    expect(companyChatUnavailableMessage(new Date("2026-09-30T12:18:00Z"))).toContain("está pausado até 09:18 por falhas seguidas");
  });

  it("diz que está desconectado e por que a Meta não entrega", () => {
    const message = companyChatUnavailableMessage(null);
    expect(message).toContain("está desconectado");
    expect(message).toContain("nas últimas 24h");
  });
});
