import { describe, expect, it } from "vitest";

import {
  buildSilenceFollowUpText,
  decideSilenceFollowUp,
  silenceFollowUpMessageId,
  silenceFollowUpWindow,
  type SilenceFollowUpInput,
  type SilenceMessage,
} from "./silence-follow-up-rules";

const msg = (id: string, direction: string, at: string, body: string, extra: Partial<SilenceMessage> = {}): SilenceMessage => ({
  id, direction, body, sentAt: new Date(at), senderRole: direction === "incoming" ? "user" : "assistant", provider: "meta", providerStatus: "sent", ...extra,
});

/** 10/11/2026, case Andréia (São Paulo = UTC-3): 14:46 first message, 14:47 reply, 14:48 the ages question. */
const andreia = [
  msg("m1", "outbound", "2026-11-10T17:46:00Z", "Olá, Andréia Deia. Recebemos seu pedido de cotação de plano de saúde na Âncora Saúde. Como prefere seguir com o atendimento?"),
  msg("m2", "incoming", "2026-11-10T17:47:00Z", "Por aqui no WhatsApp"),
  msg("m3", "outbound", "2026-11-10T17:48:00Z", "Entendi, já anotei. Quantos anos tem quem vai usar o plano? Com isso eu calculo direitinho pra você."),
];

const base = (overrides: Partial<SilenceFollowUpInput> = {}): SilenceFollowUpInput => ({
  now: new Date("2026-11-10T17:56:00Z"), // 8 min of silence
  enabled: true,
  channelSetting: "same",
  timeoutMinutes: 15,
  leadName: "Andréia Deia",
  lead: { corretorId: null, status: "new", qualificationStatus: "qualifying", distributionStatus: "unassigned", distributionRemovedAt: null, deletedAt: null, archivedAt: null },
  conversation: { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: null, wrongNumberAt: null },
  messages: andreia,
  wahaAvailable: false,
  ...overrides,
});

const skipReason = (input: SilenceFollowUpInput) => {
  const decision = decideSilenceFollowUp(input);
  return decision.action === "skip" ? decision.reason : "send";
};

describe("silenceFollowUpWindow", () => {
  it("fires at half of the timeout, at least 5 min, and stops 2 min before it", () => {
    expect(silenceFollowUpWindow(15)).toEqual({ delayMinutes: 7, latestMinutes: 13 });
    expect(silenceFollowUpWindow(30)).toEqual({ delayMinutes: 15, latestMinutes: 28 });
    expect(silenceFollowUpWindow(8)).toEqual({ delayMinutes: 5, latestMinutes: 6 });
    expect(silenceFollowUpWindow(null)).toEqual({ delayMinutes: 7, latestMinutes: 13 });
  });

  it("has no follow-up when the timeout leaves no room", () => {
    expect(silenceFollowUpWindow(7)).toBeNull();
    expect(silenceFollowUpWindow(1)).toBeNull();
  });
});

describe("decideSilenceFollowUp", () => {
  it("sends once to Andréia, by the conversation's channel, resuming the ages question", () => {
    expect(decideSilenceFollowUp(base())).toEqual({
      action: "send",
      channel: "meta",
      fallback: null,
      text: "Andréia, consegue me dizer a idade de quem vai usar o plano? Assim eu já calculo pra você agora mesmo.",
    });
  });

  it("waits for the silence and gives up near the cold timeout", () => {
    expect(skipReason(base({ now: new Date("2026-11-10T17:54:00Z") }))).toBe("too_early");
    expect(skipReason(base({ now: new Date("2026-11-10T17:55:00Z") }))).toBe("send");
    expect(skipReason(base({ now: new Date("2026-11-10T18:01:00Z") }))).toBe("too_late");
  });

  it("does not send when the customer already answered", () => {
    const messages = [...andreia, msg("m4", "incoming", "2026-11-10T17:50:00Z", "45")];
    expect(skipReason(base({ messages }))).toBe("customer_replied");
  });

  it("does not send twice", () => {
    const messages = [...andreia, msg(silenceFollowUpMessageId("lead-1"), "outbound", "2026-11-10T17:55:00Z", "Andréia, consegue...?")];
    expect(skipReason(base({ messages, now: new Date("2026-11-10T18:04:00Z") }))).toBe("already_sent");
  });

  it("does not send when a broker has the lead or a person took the conversation", () => {
    expect(skipReason(base({ lead: { ...base().lead, corretorId: "broker-1" } }))).toBe("assigned_to_broker");
    expect(skipReason(base({ conversation: { ...base().conversation!, status: "HUMAN_ACTIVE" } }))).toBe("ai_not_active");
    expect(skipReason(base({ conversation: { ...base().conversation!, automationState: "PAUSED" } }))).toBe("ai_not_active");
    const humanLast = [...andreia.slice(0, 2), msg("m3", "outbound", "2026-11-10T17:48:00Z", "Oi, sou a corretora. Posso te ligar?", { senderRole: "agent" })];
    expect(skipReason(base({ messages: humanLast }))).toBe("last_not_ai_question");
  });

  it("does not send to a discarded, lost, deleted or already classified lead", () => {
    expect(skipReason(base({ lead: { ...base().lead, status: "lost" } }))).toBe("lead_closed");
    expect(skipReason(base({ lead: { ...base().lead, deletedAt: new Date() } }))).toBe("lead_closed");
    expect(skipReason(base({ lead: { ...base().lead, archivedAt: new Date() } }))).toBe("lead_closed");
    for (const status of ["disqualified", "not_qualified", "cold", "warm", "hot", "qualified", "waiting_human"]) {
      expect(skipReason(base({ lead: { ...base().lead, qualificationStatus: status } }))).toBe("not_qualifying");
    }
    expect(skipReason(base({ lead: { ...base().lead, distributionStatus: "manual_hold" } }))).toBe("held");
  });

  it("does not send after opt-out or wrong number, nor without a conversation", () => {
    expect(skipReason(base({ conversation: { ...base().conversation!, optOutAt: new Date() } }))).toBe("opted_out");
    expect(skipReason(base({ conversation: { ...base().conversation!, wrongNumberAt: new Date() } }))).toBe("opted_out");
    expect(skipReason(base({ conversation: null }))).toBe("no_conversation");
  });

  it("leaves a lead that never answered to the turbo cadence", () => {
    expect(skipReason(base({ messages: [andreia[0]], now: new Date("2026-11-10T17:54:00Z") }))).toBe("never_replied");
  });

  it("does not send when the AI's last message is not a question", () => {
    const messages = [...andreia.slice(0, 2), msg("m3", "outbound", "2026-11-10T17:48:00Z", "Perfeito, já vou te passar para um corretor.")];
    expect(skipReason(base({ messages }))).toBe("last_not_ai_question");
  });

  it("ignores a failed AI message when reading the last one", () => {
    const messages = [...andreia, msg("m4", "outbound", "2026-11-10T17:49:00Z", "Mais alguma dúvida?", { providerStatus: "failed" })];
    expect(skipReason(base({ messages }))).toBe("send");
  });

  it("does not send at night or when switched off", () => {
    // 23:00 in São Paulo.
    const night = andreia.map((message) => ({ ...message, sentAt: new Date(message.sentAt.getTime() + 8 * 60 * 60_000 + 12 * 60_000) }));
    expect(skipReason(base({ messages: night, now: new Date("2026-11-11T02:08:00Z") }))).toBe("outside_hours");
    expect(skipReason(base({ enabled: false }))).toBe("disabled");
    expect(skipReason(base({ timeoutMinutes: 6 }))).toBe("no_room");
  });

  it("picks the channel by the setting, with fallback only on the conversation's channel", () => {
    expect(decideSilenceFollowUp(base({ wahaAvailable: true }))).toMatchObject({ action: "send", channel: "meta", fallback: "waha" });
    expect(decideSilenceFollowUp(base({ channelSetting: "waha", wahaAvailable: true }))).toMatchObject({ action: "send", channel: "waha", fallback: null });
    expect(skipReason(base({ channelSetting: "waha", wahaAvailable: false }))).toBe("no_channel");

    const waha = andreia.map((message) => ({ ...message, provider: "waha" }));
    expect(decideSilenceFollowUp(base({ messages: waha, wahaAvailable: true }))).toMatchObject({ action: "send", channel: "waha", fallback: null });
    // WAHA conversation without a run: Meta only if the customer wrote through Meta in the last 24h.
    expect(skipReason(base({ messages: waha, wahaAvailable: false }))).toBe("no_channel");
    expect(skipReason(base({ messages: waha, channelSetting: "meta", wahaAvailable: true }))).toBe("no_channel");
  });
});

describe("buildSilenceFollowUpText", () => {
  it("resumes the subject of the last question", () => {
    expect(buildSilenceFollowUpText("Quantas pessoas vão usar o plano, contando com você?", "MARIA souza")).toBe("Maria, consegue me dizer quantas pessoas vão entrar no plano? Assim eu já sigo com a sua cotação agora mesmo.");
    expect(buildSilenceFollowUpText("Em qual cidade e bairro vocês moram?", null)).toBe("Consegue me dizer em qual cidade e bairro você mora? Assim eu já vejo as opções da sua região agora mesmo.");
    expect(buildSilenceFollowUpText("O plano é só pra você, pra sua família ou pra empresa?", "Ana")).toContain("só pra você, pra família ou pra empresa");
    expect(buildSilenceFollowUpText("A empresa tem CNPJ ativo?", "Ana")).toContain("CNPJ");
    expect(buildSilenceFollowUpText("Qual o seu melhor e-mail?", "Ana")).toBe("Ana, consegue me passar o seu e-mail? Assim eu já te envio a cotação.");
  });

  it("reads the last question of a long message and does not take 'planos' as ages", () => {
    expect(buildSilenceFollowUpText("Temos ótimos planos na sua região.\n\nQuantas pessoas vão usar?", "Ana")).toContain("quantas pessoas");
  });

  it("falls back to a generic nudge and skips odd names", () => {
    expect(buildSilenceFollowUpText("Prefere que eu te mande por aqui?", "🙂 cliente")).toBe("Consegue me responder a pergunta acima? Assim eu já te ajudo agora mesmo.");
  });
});
