import { describe, expect, it } from "vitest";

import {
  parseBooleanReply,
  parseGreeting,
  parseHumanRequest,
  parseOptOut,
  parseThanks,
  parseWrongNumber,
  resolveQuickReply,
} from "./quick-reply";

describe("QuickReplyResolver", () => {
  it("normalizes greetings, confirmations and thanks without calling a model", () => {
    expect(parseGreeting("Olá, bom dia!")).toBe(true);
    expect(parseBooleanReply("SIM")).toBe(true);
    expect(parseBooleanReply("não")).toBe(false);
    expect(parseThanks("Muito obrigada")).toBe(true);
  });

  it("detects human, opt-out and wrong-number requests deterministically", () => {
    expect(parseHumanRequest("Quero falar com um atendente")).toBe(true);
    expect(parseOptOut("pare de enviar mensagens")).toBe(true);
    expect(parseWrongNumber("número errado, pessoa errada")).toBe(true);
  });

  it("never responds with AI while a human is in progress", () => {
    const result = resolveQuickReply({ body: "Oi", conversationState: "HUMAN_IN_PROGRESS", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false });
    expect(result).toMatchObject({ resolved: true, intent: "HUMAN_ALREADY_CONTACTED", templateKey: "human.already_assigned", notifyHuman: true });
  });

  it("pauses immediately for opt-out and human requests", () => {
    expect(resolveQuickReply({ body: "sair", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false })).toMatchObject({ intent: "OPT_OUT", nextState: "PAUSED" });
    expect(resolveQuickReply({ body: "atendente", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false })).toMatchObject({ intent: "REQUEST_HUMAN", nextState: "WAITING_HUMAN" });
  });

  it("does not interrupt a pending qualification question with a greeting", () => {
    const result = resolveQuickReply({ body: "Oi", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: true });
    expect(result).toMatchObject({ resolved: false, templateKey: null });
  });

  it("does not replace a pending boolean answer with a generic template", () => {
    const result = resolveQuickReply({ body: "sim", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: true });
    expect(result).toMatchObject({ resolved: false, templateKey: null });
  });

  it("handles media and suppresses duplicate waiting replies after cooldown", () => {
    expect(resolveQuickReply({ body: "", messageKind: "audio", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false })).toMatchObject({ intent: "MEDIA_RECEIVED", templateKey: "media.received" });
    const now = new Date("2026-07-27T12:00:00Z");
    expect(resolveQuickReply({ body: "ainda aguardando", conversationState: "WAITING_HUMAN", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false, now, cooldown: { waitWindowStartedAt: now, waitResponseCount: 2 }, })).toMatchObject({ resolved: true, suppressReason: "wait_limit" });
  });

  it("does not classify an ambiguous sentence as a quick intent", () => {
    expect(resolveQuickReply({ body: "Quero entender as opções disponíveis para minha família", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false }).resolved).toBe(false);
  });
});
