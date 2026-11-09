import { describe, expect, it } from "vitest";
import { businessHoursBetween, detectPostSaleKeywords, isActivePostSaleSurvey, postSaleNextTurn } from "./conversation-rules";

describe("post-sale conversation rules", () => {
  it("routes only a fresh survey on the same channel and source number", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    const base = { status: "sent", sentAt: new Date("2026-11-04T12:00:00Z"), channelType: "waha", channelRef: "waha-1" };
    expect(isActivePostSaleSurvey(base, { channelType: "waha", channelRef: "waha-1", now })).toBe(true);
    expect(isActivePostSaleSurvey(base, { channelType: "meta", channelRef: "meta-1", now })).toBe(false);
    expect(isActivePostSaleSurvey({ ...base, sentAt: new Date("2026-10-31T11:59:59Z") }, { channelType: "waha", channelRef: "waha-1", now })).toBe(false);
    expect(isActivePostSaleSurvey({ ...base, status: "completed" }, { channelType: "waha", channelRef: "waha-1", now })).toBe(false);
  });

  it("uses keyword fallback for contact, rating, quote and explicit stop", () => {
    expect(detectPostSaleKeywords("Sim, falou comigo e foi rápido. Nota 5, recebi a cotação.")).toMatchObject({ contacted: true, rating: 5, receivedQuote: true, speed: "fast" });
    expect(detectPostSaleKeywords("Pare, não quero mais mensagens.").optOut).toBe(true);
  });

  it("uses the active question to interpret short fallback answers", () => {
    expect(detectPostSaleKeywords("Sim", "se recebeu cotação").receivedQuote).toBe(true);
    expect(detectPostSaleKeywords("Não", "se recebeu cotação").receivedQuote).toBe(false);
    expect(detectPostSaleKeywords("Sim", "se ainda quer ajuda").wantsHelp).toBe(true);
    expect(detectPostSaleKeywords("Não", "se fechou o plano").closed).toBe("no");
    expect(detectPostSaleKeywords("O preço e o prazo pesaram", "motivo da decisão").reason).toBe("O preço e o prazo pesaram");
    expect(detectPostSaleKeywords("Sim", "permissão para fazer duas perguntas").contacted).toBeNull();
    expect(detectPostSaleKeywords("Não foi rápido, nota 1", "como foi o atendimento").contacted).toBeNull();
  });

  it("keeps one question at a time and never invents a price", () => {
    const first = postSaleNextTurn(0, {}, { contacted: null, comment: "Pode perguntar" }, { lead: "Ana", broker: "Bia" });
    expect(first.text).toContain("falar com Bia");
    expect(first.text).not.toMatch(/R\$|\d/);
    const second = postSaleNextTurn(1, {}, { contacted: true }, { lead: "Ana", broker: "Bia" });
    expect(second.text).toContain("Como foi o atendimento");
    expect(second.text).not.toContain("cotação");
    const third = postSaleNextTurn(2, {}, { rating: 4 }, { lead: "Ana", broker: "Bia" });
    expect(third.text).toBe("Você chegou a receber uma cotação?");
  });

  it("distinguishes decline from opt-out and finishes unanswered contacts", () => {
    expect(postSaleNextTurn(0, {}, detectPostSaleKeywords("Agora não"), { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "completed", outcome: "other" });
    expect(postSaleNextTurn(0, {}, detectPostSaleKeywords("Não"), { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "completed", outcome: "other" });
    expect(postSaleNextTurn(0, {}, detectPostSaleKeywords("Não quero mais"), { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "opted_out" });
    expect(postSaleNextTurn(3, { contacted: false }, { wantsHelp: true }, { lead: "Ana", broker: "Bia" })).toMatchObject({ status: "completed", outcome: "no_contact" });
  });

  it("counts weekday business time, excluding nights and weekends", () => {
    expect(businessHoursBetween(new Date("2026-11-06T15:00:00Z"), new Date("2026-11-09T15:00:00Z"))).toBe(10 * 60 * 60_000);
  });
});

import { canResumePostSaleNow, decidePostSaleNudge } from "./conversation-rules";

describe("lembrete da pesquisa (4 h úteis)", () => {
  // Terça 10/11/2026 (já na regra de 4 h), horário de São Paulo (UTC-3).
  const at = (hhmm: string) => new Date(`2026-11-10T${hhmm}:00-03:00`);
  const base = { sentAt: at("08:04"), lastReplyAt: null as Date | null, reminderSentAt: null as Date | null, channelType: "meta", isR0: false };

  it("sem resposta à abertura: lembrete depois de 4 h úteis", () => {
    expect(decidePostSaleNudge({ ...base, now: at("11:00") }).action).toBe("none");
    expect(decidePostSaleNudge({ ...base, now: at("12:10") }).action).toBe("remind_opening");
  });

  it("no meio da conversa: repete a pergunta 4 h úteis depois da última resposta (caso Dayana)", () => {
    const dayana = { ...base, lastReplyAt: at("12:36") };
    expect(decidePostSaleNudge({ ...dayana, now: at("15:00") }).action).toBe("none");
    expect(decidePostSaleNudge({ ...dayana, now: at("16:40") }).action).toBe("remind_question");
  });

  it("um lembrete por etapa; depois fecha como sem resposta", () => {
    const reminded = { ...base, lastReplyAt: at("12:36"), reminderSentAt: at("16:40") };
    expect(decidePostSaleNudge({ ...reminded, now: at("17:00") }).action).toBe("none");
    expect(decidePostSaleNudge({ ...reminded, now: new Date("2026-11-13T12:00:00-03:00") }).action).toBe("close_no_reply");
  });

  it("número oficial fora da janela de 24 h não manda texto livre", () => {
    const old = { ...base, lastReplyAt: new Date("2026-11-06T09:00:00-03:00") };
    expect(decidePostSaleNudge({ ...old, now: at("10:00") }).action).not.toBe("remind_question");
    expect(canResumePostSaleNow({ lastReplyAt: old.lastReplyAt, channelType: "meta", now: at("10:00") })).toBe(false);
    expect(canResumePostSaleNow({ lastReplyAt: old.lastReplyAt, channelType: "waha", now: at("10:00") })).toBe(true);
  });

  it("R0 não tem lembrete", () => {
    expect(decidePostSaleNudge({ ...base, isR0: true, now: at("16:00") }).action).toBe("none");
  });
});

describe("transição para a regra de 4 h", () => {
  it("pesquisa enviada antes da regra mantém 24 h para o lembrete da abertura", () => {
    const sentAt = new Date("2026-11-09T08:04:00-03:00");
    expect(decidePostSaleNudge({ sentAt, lastReplyAt: null, reminderSentAt: null, channelType: "meta", isR0: false, now: new Date("2026-11-09T17:00:00-03:00") }).action).toBe("none");
    const newer = new Date("2026-11-10T08:04:00-03:00");
    expect(decidePostSaleNudge({ sentAt: newer, lastReplyAt: null, reminderSentAt: null, channelType: "meta", isR0: false, now: new Date("2026-11-10T12:10:00-03:00") }).action).toBe("remind_opening");
  });
});
