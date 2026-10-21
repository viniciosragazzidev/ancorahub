import { describe, expect, it } from "vitest";

import {
  parseBooleanReply,
  parseGreeting,
  parseHumanRequest,
  parseOptOut,
  parseThanks,
  parseWrongNumber,
  resolveQuickReply,
  shouldContinueQualificationAfterMedia,
  terminalReplyLeadDisposition,
} from "./quick-reply";
import { automaticDistributionHoldReason } from "@/features/lead-distribution/domain";

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

  it("holds a terminal lead for the director instead of distributing it (case Vanessa, 18/10)", () => {
    expect(terminalReplyLeadDisposition()).toEqual({ status: "new", distributionStatus: "manual_hold", qualificationStatus: "disqualified", qualificationState: "COMPLETED" });
    expect(automaticDistributionHoldReason(terminalReplyLeadDisposition().qualificationStatus, "COMPLETED")).not.toBeNull();
  });

  it("reads 'already solved' as no interest, without catching a mid-conversation 'já consegui os documentos'", () => {
    for (const text of ["Já consegui", "já consegui, obrigada", "Não quero não", "Já fechei com outro corretor", "contratei com outra", "já tenho plano"]) {
      expect(parseOptOut(text), text).toBe(true);
    }
    expect(parseOptOut("já consegui os documentos")).toBe(false);
    expect(parseOptOut("quero sim")).toBe(false);
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

  it("lets an attachment continue the pending qualification instead of short-circuiting it", () => {
    expect(shouldContinueQualificationAfterMedia({
      messageKind: "image",
      hasPendingQuestion: true,
      conversationState: "AI_ACTIVE",
    })).toBe(true);
    expect(shouldContinueQualificationAfterMedia({
      messageKind: "image",
      hasPendingQuestion: false,
      conversationState: "AI_ACTIVE",
    })).toBe(false);
  });

  it("does not classify an ambiguous sentence as a quick intent", () => {
    expect(resolveQuickReply({ body: "Quero entender as opções disponíveis para minha família", conversationState: "AI_ACTIVE", isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false }).resolved).toBe(false);
  });
});

describe("botões dos templates da qualificação turbo", () => {
  const base = { conversationState: "AI_ACTIVE" as const, isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: true };

  it("'Pode encerrar' para a sequência; 'Agora não' é objeção e vai para a IA", () => {
    expect(resolveQuickReply({ ...base, body: "Pode encerrar" }).intent).toBe("OPT_OUT");
    expect(resolveQuickReply({ ...base, body: "Agora não" }).resolved).toBe(false);
  });

  it("recusa suave não encerra: a IA pergunta o motivo (caso Adelair)", () => {
    for (const body of ["Eu já tenho", "já tenho plano", "Não tenho interesse", "sem interesse", "Não quero não"]) {
      expect(resolveQuickReply({ ...base, body }).resolved, body).toBe(false);
    }
  });

  it("comando explícito de parar encerra na hora", () => {
    for (const body of ["sair", "pare de enviar mensagens", "não me mande mais mensagens", "não solicitei isso"]) {
      expect(resolveQuickReply({ ...base, body }).intent, body).toBe("OPT_OUT");
    }
  });

  it("'Prefiro ligação' passa o lead para um corretor ligar", () => {
    const result = resolveQuickReply({ ...base, body: "Prefiro ligação" });
    expect(result.intent).toBe("REQUEST_CALLBACK");
    expect(result.nextState).toBe("WAITING_HUMAN");
    expect(resolveQuickReply({ ...base, body: "Pode me ligar" }).intent).toBe("REQUEST_CALLBACK");
  });

  it("botões de continuar seguem para a próxima pergunta", () => {
    for (const body of ["Por aqui no WhatsApp", "Quero ver as opções", "Quero receber", "Ainda procuro", "Prefiro por aqui"]) {
      expect(resolveQuickReply({ ...base, body }).ruleKey, body).toBe("start_qualification");
    }
  });

  it("botões de tipo de plano chegam à extração da resposta", () => {
    for (const body of ["Só para mim", "Para minha família", "Para minha empresa"]) {
      expect(resolveQuickReply({ ...base, body }).resolved, body).toBe(false);
    }
  });
});

describe("pedido de ligação só quando o lead pede (revisão 21/10)", () => {
  const base = { conversationState: "AI_ACTIVE" as const, isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: true };
  it("'não quero ligação' não vira pedido de ligação", () => {
    expect(resolveQuickReply({ ...base, body: "não quero ligação" }).intent).not.toBe("REQUEST_CALLBACK");
    expect(resolveQuickReply({ ...base, body: "não precisa me ligar" }).intent).not.toBe("REQUEST_CALLBACK");
  });
  it("'pode me chamar por aqui' continua no WhatsApp", () => {
    expect(resolveQuickReply({ ...base, body: "pode me chamar por aqui" }).intent).not.toBe("REQUEST_CALLBACK");
  });
});
