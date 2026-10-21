import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";

import { buildLeadConversationScript, dateLabel, isInternalNote, type LeadConversationLead } from "./lead-script";

const now = new Date("2026-10-09T15:00:00.000Z"); // 12:00 in São Paulo

function lead(overrides: Partial<LeadConversationLead> = {}): LeadConversationLead {
  return {
    id: "l1",
    nome: "Maria Souza",
    status: "distributed",
    telefone: null,
    tipo: "PME",
    origem: "meta_lead_ads",
    sourceCampaign: "PME Outubro",
    livesCount: 3,
    city: "Nova Iguaçu",
    createdAt: new Date("2026-10-09T14:50:00.000Z"),
    assignedAt: new Date("2026-10-09T14:55:00.000Z"),
    slaFirstContactMinutes: 15,
    isCurrentBroker: true,
    potentialSale: false,
    ...overrides,
  };
}

function build(overrides: Partial<LeadConversationLead> = {}, events: Parameters<typeof buildLeadConversationScript>[0]["events"] = []) {
  return buildLeadConversationScript({ lead: lead(overrides), events, viewerId: "me", now, whatsappUrl: "https://wa.me/5521999999999" });
}

function question(blocks: ChatBlock[], id: string) {
  const block = blocks.find((item) => item.type === "question" && item.id === id);
  if (!block || block.type !== "question") throw new Error(`question ${id} missing`);
  return block;
}

describe("buildLeadConversationScript", () => {
  it("shows which plantão the lead came from in the facts card", () => {
    const facts = build({ dutyName: "PRESENCIAL TARDE" }).blocks.find((block) => block.type === "facts");
    expect(facts).toMatchObject({ rows: expect.arrayContaining([{ label: "Plantão", value: "PRESENCIAL TARDE" }]) });
  });

  it("opens with the arrival, the facts card and the SLA for a new lead", () => {
    const script = build();
    expect(script.blocks[0]).toMatchObject({ type: "date", label: "Hoje, 11:50" });
    expect(script.blocks[1]).toMatchObject({ type: "system", strong: "Maria Souza", text: "chegou da campanha PME Outubro" });
    const facts = script.blocks.find((block) => block.type === "facts");
    expect(facts).toMatchObject({ rows: expect.arrayContaining([{ label: "Vidas", value: "3" }]) });
    expect(script.blocks.some((block) => block.type === "assistant" && block.text.includes("Faltam 10 min"))).toBe(true);
    expect(script.status).toMatchObject({ label: "Esperando você", tone: "waiting" });
  });

  it("offers accept, decline (with reasons) and the full record before the first contact", () => {
    const { blocks } = build();
    const main = question(blocks, "q-main");
    expect(main.choices.map((choice) => choice.id)).toEqual(["start", "decline", "ficha"]);
    expect(main.choices[0].action).toEqual({ kind: "server", name: "lead.registerContact", payload: { leadId: "l1" } });
    expect(main.choices[1].action).toEqual({ kind: "next", questionId: "q-decline" });
    expect(question(blocks, "q-decline").choices[0].action).toMatchObject({ kind: "server", name: "lead.decline" });
  });

  it("guides the attendance with WhatsApp, stage, return and loss", () => {
    const { blocks } = build({ status: "in_contact", telefone: "(21) 99999-9999" });
    const main = question(blocks, "q-main");
    expect(main.choices.map((choice) => choice.id)).toEqual(["whatsapp", "waiting-reply", "quote", "negotiation", "return", "ficha#venda", "lost"]);
    expect(question(blocks, "q-quote").choices[0].action).toEqual({ kind: "server", name: "lead.changeStep", payload: { leadId: "l1", status: "quote_sent", when: "tomorrow" } });
    // "Chamar no WhatsApp" opens WhatsApp in the same tap: no green button below (2026-10-12).
    expect(main.choices[0]?.action).toEqual({ kind: "local", value: "whatsapp:https://wa.me/5521999999999" });
    expect(blocks.find((block) => block.id === "b-whatsapp")).toBeUndefined();
    expect(question(blocks, "q-return").choices.map((choice) => choice.action)).toContainEqual({ kind: "server", name: "lead.scheduleReturn", payload: { leadId: "l1", when: "today" } });
    expect(question(blocks, "q-lost").choices[0].action).toEqual({ kind: "server", name: "lead.markLost", payload: { leadId: "l1", reason: "sem_contato" } });
  });

  it("does not offer the current stage again", () => {
    const { blocks } = build({ status: "quote_sent" });
    const ids = question(blocks, "q-main").choices.map((choice) => choice.id);
    expect(ids).not.toContain("quote");
    expect(blocks.some((block) => block.id === "q-quote")).toBe(false);
  });

  it("sends a likely sale to the full record to justify the loss", () => {
    const { blocks } = build({ status: "negotiation", potentialSale: true });
    const lost = question(blocks, "q-main").choices.find((choice) => choice.label === "Não deu certo");
    expect(lost?.action).toEqual({ kind: "href", href: "/leads/l1?ficha=1#etapa" });
    expect(blocks.some((block) => block.id === "q-lost")).toBe(false);
  });

  it("shows the history as chat: own notes on the right, other events centered, by day", () => {
    const { blocks } = build({ status: "in_contact" }, [
      { id: "e2", tipo: "note", conteudo: "Pediu Amil", userId: "me", userName: "Eu", createdAt: new Date("2026-10-09T14:58:00.000Z") },
      { id: "e1", tipo: "service_started", conteudo: "Atendimento iniciado", userId: "me", userName: "Eu", createdAt: new Date("2026-10-08T13:00:00.000Z") },
      { id: "e3", tipo: "note", conteudo: "Ligar à tarde", userId: "boss", userName: "Keyla", createdAt: new Date("2026-10-09T14:59:00.000Z") },
    ]);
    const ids = blocks.map((block) => block.id);
    expect(ids.indexOf("ev-e1")).toBeLessThan(ids.indexOf("ev-e2"));
    expect(blocks.find((block) => block.id === "ev-e2")).toMatchObject({ type: "user", text: "Pediu Amil" });
    expect(blocks.find((block) => block.id === "ev-e3")).toMatchObject({ type: "system", strong: "Keyla" });
    expect(blocks.some((block) => block.type === "date" && block.id === "d-e2")).toBe(true);
  });

  it("shows only the latest AI feedback, as its short next action", () => {
    const { blocks } = build({ status: "in_contact" }, [
      { id: "a1", tipo: "system_alert", conteudo: "[IA Feedback] Resumo antigo.\n\nPróxima Ação: Ligar amanhã.", userId: "me", userName: "Eu", createdAt: new Date("2026-10-13T14:57:00.000Z") },
      { id: "a2", tipo: "system_alert", conteudo: "[IA Feedback] Resumo longo da conversa.\n\nPróxima Ação: Enviar a cotação prometida. Depois confirmar o recebimento.", userId: "me", userName: "Eu", createdAt: new Date("2026-10-13T14:59:00.000Z") },
    ]);
    expect(blocks.some((block) => block.id === "ev-a1")).toBe(false);
    const latest = blocks.find((block) => block.id === "ev-a2");
    expect(latest).toMatchObject({ type: "system", strong: "Sugestão da IA" });
    expect(latest && "text" in latest ? latest.text : "").toMatch(/^Enviar a cotação prometida\. ·/);
  });

  it("falls back to the AI text, cut short, when the next action marker is missing", () => {
    const { blocks } = build({ status: "in_contact" }, [
      { id: "a3", tipo: "system_alert", conteudo: `[IA Feedback] ${"Texto sem marcador ".repeat(20)}`, userId: "me", userName: "Eu", createdAt: new Date("2026-10-13T14:59:00.000Z") },
    ]);
    const block = blocks.find((item) => item.id === "ev-a3");
    const text = (block && "text" in block ? block.text : "") ?? "";
    expect(text.startsWith("Texto sem marcador")).toBe(true);
    expect(text.split(" · ")[0]?.length).toBeLessThanOrEqual(180);
  });

  it("is read only for a lead of another broker", () => {
    const script = build({ isCurrentBroker: false, status: "in_contact" });
    expect(question(script.blocks, "q-main").choices.map((choice) => choice.id)).toEqual(["ficha"]);
    expect(script.composerPlaceholder).toContain("Só o corretor");
  });

  it("tells the loss reason of a closed lead", () => {
    const { blocks } = build({ status: "lost", motivoPerda: "preco" });
    expect(blocks.find((block) => block.id === "a-next")).toMatchObject({ text: "Atendimento encerrado: Preço acima do esperado." });
  });
});

describe("WhatsApp in the lead conversation", () => {
  it("mixes the client's messages (left) and the broker's (right) with the history and puts the AI tip before the choices", () => {
    const script = buildLeadConversationScript({
      lead: lead({ status: "in_contact" }),
      events: [{ id: "e1", tipo: "service_started", conteudo: "Atendimento iniciado", userId: "me", userName: "Eu", createdAt: new Date("2026-10-09T14:52:00.000Z") }],
      viewerId: "me",
      now,
      whatsappUrl: null,
      messages: [
        { id: "w2", body: "Quanto fica?", direction: "incoming", sentAt: new Date("2026-10-09T14:56:00.000Z") },
        { id: "w1", body: "Oi Maria!", direction: "outgoing", sentAt: new Date("2026-10-09T14:53:00.000Z") },
        { id: "w0", body: "Quantas vidas?", direction: "outbound", senderRole: "assistant", sentAt: new Date("2026-10-09T14:52:30.000Z") },
      ],
      advice: { pendingFrom: "BROKER", nextBestAction: "Mandar a cotação PME" },
    });
    const ids = script.blocks.map((block) => block.id);
    expect(ids.indexOf("ev-e1")).toBeLessThan(ids.indexOf("wa-w1"));
    expect(ids.indexOf("wa-w1")).toBeLessThan(ids.indexOf("wa-w2"));
    expect(script.blocks.find((block) => block.id === "wa-w1")).toMatchObject({ type: "whatsapp", from: "broker" });
    expect(script.blocks.find((block) => block.id === "wa-w2")).toMatchObject({ type: "whatsapp", from: "client", text: "Quanto fica?" });
    expect(script.blocks.find((block) => block.id === "wa-w0")).toMatchObject({ type: "whatsapp", from: "qualification" });
    expect(script.blocks.find((block) => block.id === "a-next")).toMatchObject({ text: "Maria está esperando sua resposta." });
    expect(ids.indexOf("a-advice")).toBeLessThan(ids.indexOf("q-main"));
  });

  it("keeps a voice note in the history as an audio block, not as an empty bubble", () => {
    const script = buildLeadConversationScript({
      lead: lead(),
      events: [],
      viewerId: "me",
      now,
      whatsappUrl: null,
      messages: [
        { id: "m-audio", body: "", direction: "incoming", sentAt: new Date("2026-10-09T14:56:00.000Z"), mediaKind: "audio" },
        { id: "m-placeholder", body: "[audio]", direction: "outgoing", sentAt: new Date("2026-10-09T14:57:00.000Z"), mediaKind: "audio" },
        { id: "m-caption", body: "Ouve isso", direction: "outgoing", sentAt: new Date("2026-10-09T14:58:00.000Z"), mediaKind: "audio" },
      ],
    });

    expect(script.blocks.find((block) => block.id === "wa-m-audio")).toMatchObject({ type: "whatsapp", from: "client", text: "", audio: { url: "/api/conversations/media/m-audio" } });
    expect(script.blocks.find((block) => block.id === "wa-m-placeholder")).toMatchObject({ text: "", audio: { url: "/api/conversations/media/m-placeholder" } });
    expect(script.blocks.find((block) => block.id === "wa-m-caption")).toMatchObject({ text: "Ouve isso", audio: { url: "/api/conversations/media/m-caption" } });
  });

  it("does not draw a \"[text]\" bubble on the client side for a WhatsApp protocol event (bug 2026-10-21)", () => {
    const script = buildLeadConversationScript({
      lead: lead(),
      events: [],
      viewerId: "me",
      now,
      whatsappUrl: null,
      messages: [
        { id: "m-real", body: "Oi, tudo bem?", direction: "incoming", sentAt: new Date("2026-10-09T14:55:00.000Z") },
        { id: "m-empty", body: "[text]", direction: "incoming", sentAt: new Date("2026-10-09T14:56:00.000Z"), mediaKind: null },
        { id: "m-blank", body: "  ", direction: "incoming", sentAt: new Date("2026-10-09T14:57:00.000Z") },
        { id: "m-image", body: "[image]", direction: "incoming", sentAt: new Date("2026-10-09T14:58:00.000Z") },
      ],
    });

    expect(script.blocks.find((block) => block.id === "wa-m-real")).toMatchObject({ from: "client", text: "Oi, tudo bem?" });
    expect(script.blocks.find((block) => block.id === "wa-m-empty")).toBeUndefined();
    expect(script.blocks.find((block) => block.id === "wa-m-blank")).toBeUndefined();
    expect(script.blocks.find((block) => block.id === "wa-m-image")).toMatchObject({ text: "Imagem indisponível" });
    expect(JSON.stringify(script.blocks)).not.toContain("[text]");
  });

  it("hides the time of a voice note from the broker when the arrival is hidden", () => {
    const script = buildLeadConversationScript({
      lead: lead(),
      events: [],
      viewerId: "me",
      now,
      whatsappUrl: null,
      hideArrival: true,
      messages: [{ id: "m-audio", body: "", direction: "incoming", sentAt: new Date("2026-10-09T14:56:00.000Z"), mediaKind: "audio" }],
    });

    expect(script.blocks.find((block) => block.id === "wa-m-audio")).toMatchObject({ audio: { url: "/api/conversations/media/m-audio" } });
    expect(script.blocks.find((block) => block.id === "wa-m-audio")).not.toMatchObject({ at: expect.anything() });
  });
});

describe("block ids", () => {
  // A "next" reply hides its target by id: two blocks with the same id would both stay hidden.
  it("are unique in every stage of the lead", () => {
    for (const status of ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "converted", "lost"]) {
      for (const potentialSale of [false, true]) {
        const { blocks } = buildLeadConversationScript({
          lead: lead({ status, potentialSale, telefone: "(21) 99999-9999" }),
          events: [{ id: "e1", tipo: "note", conteudo: "x", userId: "me", userName: "Eu", createdAt: new Date("2026-10-09T14:52:00.000Z") }],
          viewerId: "me",
          now,
          whatsappUrl: "https://wa.me/5521999999999",
          messages: [{ id: "w1", body: "Oi", direction: "incoming", sentAt: new Date("2026-10-09T14:53:00.000Z") }],
        });
        const ids = blocks.map((block) => block.id);
        expect(new Set(ids).size, `${status} ${potentialSale}`).toBe(ids.length);
      }
    }
  });
});

describe("dateLabel", () => {
  it("says today, yesterday or the date", () => {
    expect(dateLabel(new Date("2026-10-08T22:00:00.000Z"), now)).toBe("Ontem, 19:00");
    expect(dateLabel(new Date("2026-10-01T12:00:00.000Z"), now)).toBe("01/10, 09:00");
  });
});

describe("hideArrival", () => {
  it("drops the date of the first contact but keeps the conversation", () => {
    const script = buildLeadConversationScript({
      lead: lead({ origem: null, sourceCampaign: null }),
      events: [],
      viewerId: "me",
      now,
      whatsappUrl: null,
      hideArrival: true,
    });
    expect(script.blocks.some((block) => block.id === "d-created")).toBe(false);
    expect(script.blocks.some((block) => block.id === "s-arrived")).toBe(true);
  });

  it("hides the dates and times of the conversation", () => {
    const script = buildLeadConversationScript({
      lead: lead(),
      events: [{ id: "e1", tipo: "system_alert", conteudo: "Qualificação finalizada", userId: "me", userName: "Eu", createdAt: new Date("2026-10-07T02:25:00.000Z") }],
      messages: [{ id: "m1", body: "Plano para 71 anos", direction: "incoming", senderRole: "user", sentAt: new Date("2026-10-07T10:23:00.000Z") }],
      viewerId: "me",
      now,
      whatsappUrl: null,
      hideArrival: true,
    });
    expect(script.blocks.some((block) => block.type === "date")).toBe(false);
    expect(script.blocks.find((block) => block.id === "wa-m1")).toMatchObject({ at: undefined });
    expect(script.blocks.find((block) => block.id === "ev-e1")).toMatchObject({ text: "Qualificação finalizada" });
  });

  it("shows the date of the first contact by default", () => {
    const script = buildLeadConversationScript({ lead: lead(), events: [], viewerId: "me", now, whatsappUrl: null });
    expect(script.blocks.some((block) => block.id === "d-created")).toBe(true);
  });
});

describe("internal notes", () => {
  it("hides the qualification timeout note from the broker", () => {
    expect(isInternalNote({ conteudo: "Tempo limite da qualificação excedido (15 min). Lead não informou dado válido em resposta à qualificação, foi classificado como Frio e permaneceu com qualificação parcial na fila configurada." })).toBe(true);
    expect(isInternalNote({ conteudo: "[IA Feedback] Próxima Ação: ligar" })).toBe(false);
  });
});
