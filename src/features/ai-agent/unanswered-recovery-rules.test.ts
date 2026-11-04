import { describe, expect, it } from "vitest";

import { findUnansweredInbound, type RecoveryMessage } from "./unanswered-recovery-rules";

const message = (direction: string, at: string, body: string, provider = "meta_cloud", mediaKind: string | null = null): RecoveryMessage => ({
  direction, body, provider, mediaKind, sentAt: new Date(at), messageId: `m-${at}`, communicationChannelId: "channel-1",
});

/** 04/11/2026, 18:19 (São Paulo): three messages in 12 s and no answer. */
const viva = [
  message("incoming", "2026-11-04T21:19:30Z", "Digite sua idade por favor."),
  message("incoming", "2026-11-04T21:19:37Z", "RJ"),
  message("incoming", "2026-11-04T21:19:42Z", "62 anos"),
];
const waiting = { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE" };

describe("findUnansweredInbound", () => {
  it("Viva: the whole burst is answered in one turn, from the newest message", () => {
    const pending = findUnansweredInbound({ messages: viva, conversation: waiting, qualificationStatus: "qualifying", now: new Date("2026-11-04T21:26:00Z"), minAgeMs: 90_000 });
    expect(pending?.latest.body).toBe("62 anos");
    expect(pending?.body).toBe("Digite sua idade por favor.\nRJ\n62 anos");
    expect(pending?.messageKind).toBe("text");
  });

  it("does nothing once the AI or a person answered after the last customer message", () => {
    const answered = [...viva, message("outbound", "2026-11-04T21:19:50Z", "Boa noite, Viva...", "meta")];
    expect(findUnansweredInbound({ messages: answered, conversation: waiting, qualificationStatus: "qualifying", now: new Date("2026-11-04T21:26:00Z") })).toBeNull();
    const byBroker = [...viva, message("outgoing", "2026-11-04T21:20:10Z", "Oi Viva", "waha")];
    expect(findUnansweredInbound({ messages: byBroker, conversation: waiting, qualificationStatus: "qualifying", now: new Date("2026-11-04T21:26:00Z") })).toBeNull();
  });

  it("a reply the provider refused is not an answer", () => {
    const failed = [...viva, { ...message("outbound", "2026-11-04T21:19:50Z", "Boa noite, Viva...", "meta"), providerStatus: "failed" }];
    expect(findUnansweredInbound({ messages: failed, conversation: waiting, qualificationStatus: "qualifying", now: new Date("2026-11-04T21:26:00Z") })?.latest.body).toBe("62 anos");
    const twice = [...failed, { ...message("outbound", "2026-11-04T21:22:00Z", "Boa noite, Viva...", "meta"), providerStatus: "failed" }];
    expect(findUnansweredInbound({ messages: twice, conversation: waiting, qualificationStatus: "qualifying", now: new Date("2026-11-04T21:26:00Z") })).toBeNull();
  });

  it("leaves the normal path its time: a message younger than the minimum age is not recovered", () => {
    expect(findUnansweredInbound({ messages: viva, conversation: waiting, qualificationStatus: "qualifying", now: new Date("2026-11-04T21:20:00Z"), minAgeMs: 90_000 })).toBeNull();
  });

  it("never acts after the handoff, on a paused conversation or on a qualified lead", () => {
    const now = new Date("2026-11-04T21:26:00Z");
    expect(findUnansweredInbound({ messages: viva, conversation: { status: "WAITING_HUMAN", automationState: "AI_ACTIVE" }, qualificationStatus: "qualifying", now })).toBeNull();
    expect(findUnansweredInbound({ messages: viva, conversation: { status: "WAITING_CUSTOMER", automationState: "PAUSED" }, qualificationStatus: "qualifying", now })).toBeNull();
    expect(findUnansweredInbound({ messages: viva, conversation: waiting, qualificationStatus: "hot", now })).toBeNull();
    expect(findUnansweredInbound({ messages: viva, conversation: null, qualificationStatus: "pending", now })).toBeNull();
  });

  it("only answers on the official number and keeps a media message as media", () => {
    const now = new Date("2026-11-04T21:26:00Z");
    expect(findUnansweredInbound({ messages: [message("incoming", "2026-11-04T21:19:30Z", "oi", "waha")], conversation: waiting, qualificationStatus: "pending", now })).toBeNull();
    const audio = findUnansweredInbound({ messages: [message("incoming", "2026-11-04T21:19:30Z", "[audio]", "meta_cloud", "audio")], conversation: waiting, qualificationStatus: "pending", now });
    expect(audio?.messageKind).toBe("audio");
  });
});
