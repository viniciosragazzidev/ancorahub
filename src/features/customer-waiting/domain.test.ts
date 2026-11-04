import { describe, expect, it } from "vitest";

import { assessCustomerWaiting, needsReply, soundsFrustrated, type CustomerWaitingMessage } from "./domain";
import { addBusinessMilliseconds, businessMillisecondsBetween } from "@/shared/time/business-hours";

const incoming = (sentAt: string, body: string, mediaKind: string | null = null): CustomerWaitingMessage => ({ direction: "incoming", senderRole: "user", body, mediaKind, sentAt });
const ai = (sentAt: string, body: string): CustomerWaitingMessage => ({ direction: "outbound", senderRole: "assistant", body, mediaKind: null, sentAt });
const human = (sentAt: string, body: string): CustomerWaitingMessage => ({ direction: "outgoing", senderRole: "user", body, mediaKind: null, sentAt });

/** The real conversation of 20/10/2026 (UTC; São Paulo is UTC-3). */
const vera: CustomerWaitingMessage[] = [
  incoming("2026-10-20T15:28:28Z", "Digite sua idade e receba uma cotação personalizada do Plano Assim"),
  ai("2026-10-20T15:28:44Z", "O plano seria individual, familiar ou empresarial (CNPJ)?"),
  incoming("2026-10-20T15:29:16Z", "Individual  67 anos"),
  ai("2026-10-20T15:29:27Z", "Anotei: individual e 67 anos. Última pergunta: em qual cidade?"),
  incoming("2026-10-20T15:29:47Z", "Rio de Janeiro"),
  ai("2026-10-20T15:30:00Z", "Obrigado, Vera! ... já passei seu atendimento para um corretor especialista."),
  incoming("2026-10-20T15:32:30Z", "Digite sua idade por favor."),
  incoming("2026-10-20T15:32:56Z", "67"),
  incoming("2026-10-20T15:33:20Z", "Digite sua idade por favor."),
  incoming("2026-10-20T15:33:49Z", "Digite sua idade por favor."),
  incoming("2026-10-20T15:34:08Z", "67 anos"),
  incoming("2026-10-20T17:37:35Z", "Esqueceram  de me dar os valores"),
];
const veraAssignedAt = "2026-10-20T15:36:50Z";

describe("business time", () => {
  it("counts only weekdays from 08:00 to 18:00 in São Paulo", () => {
    // Friday 17:30 to Monday 08:30 (local) is 30 + 30 minutes of business time.
    expect(businessMillisecondsBetween(new Date("2026-10-23T20:30:00Z"), new Date("2026-10-26T11:30:00Z"))).toBe(60 * 60_000);
    expect(addBusinessMilliseconds(new Date("2026-10-23T20:30:00Z"), 60 * 60_000).toISOString()).toBe("2026-10-26T11:30:00.000Z");
  });
  it("starts at the opening when the period begins at night", () => {
    expect(businessMillisecondsBetween(new Date("2026-10-20T02:00:00Z"), new Date("2026-10-20T11:15:00Z"))).toBe(15 * 60_000);
  });
});

describe("assessCustomerWaiting", () => {
  it("Vera: the clock starts at the acceptance and the charge is due after 15 business minutes", () => {
    const at = assessCustomerWaiting({ messages: vera.slice(0, 11), assignedAt: veraAssignedAt, now: new Date("2026-10-20T15:52:00Z") });
    expect(at).toMatchObject({
      cycleStartedAt: "2026-10-20T15:32:30.000Z",
      clockStartedAt: "2026-10-20T15:36:50.000Z",
      stage: "acknowledge",
      nextStage: "second_charge",
      nextStageAt: "2026-10-20T16:21:50.000Z",
      unansweredCount: 3,
    });
  });

  it("Vera: two business hours later the broker would have been replaced, and the complaint is quoted", () => {
    const at = assessCustomerWaiting({ messages: vera, assignedAt: veraAssignedAt, now: new Date("2026-10-20T17:40:00Z") });
    expect(at?.stage).toBe("reassign");
    expect(at?.nextStage).toBeNull();
    expect(at?.urgent).toBe(true);
    expect(at?.customerQuote).toBe("Esqueceram  de me dar os valores");
    expect(at?.metaWindowOpen).toBe(true);
  });

  it("a reply from the broker's WhatsApp closes the cycle", () => {
    expect(assessCustomerWaiting({ messages: [...vera, human("2026-10-20T17:45:00Z", "Oi Vera, segue a cotação")], assignedAt: veraAssignedAt, now: new Date("2026-10-20T19:00:00Z") })).toBeNull();
  });

  it("an AI message after the assignment does not close the cycle", () => {
    const at = assessCustomerWaiting({ messages: [...vera, ai("2026-10-20T17:50:00Z", "Vera, recebi sua mensagem.")], assignedAt: veraAssignedAt, now: new Date("2026-10-20T18:00:00Z") });
    expect(at?.stage).toBe("reassign");
  });

  it("closings, stickers and repeated ad text do not open a cycle", () => {
    const messages = [human("2026-10-21T12:00:00Z", "Segue a cotação"), incoming("2026-10-21T12:05:00Z", "Ok, obrigado!"), incoming("2026-10-21T12:06:00Z", "", "sticker")];
    expect(assessCustomerWaiting({ messages, assignedAt: veraAssignedAt, now: new Date("2026-10-21T16:00:00Z") })).toBeNull();
  });

  it("the customer saying the broker already talks to them elsewhere does not open a cycle", () => {
    expect(assessCustomerWaiting({ messages: [incoming("2026-10-21T12:05:00Z", "Já estou falando  aki com corretor")], assignedAt: veraAssignedAt, now: new Date("2026-10-21T16:00:00Z") })).toBeNull();
  });

  it("an AI answer after the assignment keeps the broker accountable but marks that the customer got a reply", () => {
    const at = assessCustomerWaiting({ messages: [incoming("2026-10-21T12:05:00Z", "Não tenho plano"), ai("2026-10-21T12:05:20Z", "Pronto, já passei suas informações para Luiz.")], assignedAt: veraAssignedAt, now: new Date("2026-10-21T16:00:00Z") });
    expect(at).toMatchObject({ stage: "reassign", aiRepliedLast: true });
  });

  it("does not count the night: a message at 22:00 is still in the first step at 08:10", () => {
    const at = assessCustomerWaiting({ messages: [incoming("2026-10-21T01:00:00Z", "Qual o valor?")], assignedAt: veraAssignedAt, now: new Date("2026-10-21T11:10:00Z") });
    expect(at).toMatchObject({ stage: "watching", waitingBusinessMinutes: 10, nextStage: "acknowledge" });
  });
});

describe("message rules", () => {
  it("a repeated text does not ask for a new answer", () => {
    expect(needsReply(incoming("2026-10-20T15:33:20Z", "Digite sua idade por favor."), new Set(["digite sua idade por favor"]))).toBe(false);
    expect(needsReply(incoming("2026-10-20T15:33:20Z", "", "audio"), new Set())).toBe(true);
    expect(needsReply(incoming("2026-10-20T15:33:20Z", "Obrigada pela atenção"), new Set())).toBe(false);
    expect(needsReply(incoming("2026-10-20T15:33:20Z", "Obrigada, mas qual o valor para 2 pessoas?"), new Set())).toBe(true);
  });
  it("recognizes frustration", () => {
    expect(soundsFrustrated("QUAL O VALOR  PARA A IDADE DE 67 ANOS SEM NPJ")).toBe(true);
    expect(soundsFrustrated("Esqueceram de me dar os valores")).toBe(true);
    expect(soundsFrustrated("Qual o valor para 67 anos?")).toBe(false);
  });
});
