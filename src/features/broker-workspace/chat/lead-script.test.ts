import { describe, expect, it } from "vitest";

import type { ChatBlock } from "@/components/chat/types";

import { buildLeadConversationScript, dateLabel, type LeadConversationLead } from "./lead-script";

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
    expect(main.choices.map((choice) => choice.id)).toEqual(["whatsapp", "quote", "negotiation", "return", "ficha#venda", "lost"]);
    expect(question(blocks, "q-quote").choices[0].action).toEqual({ kind: "server", name: "lead.changeStep", payload: { leadId: "l1", status: "quote_sent", when: "tomorrow" } });
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

describe("dateLabel", () => {
  it("says today, yesterday or the date", () => {
    expect(dateLabel(new Date("2026-10-08T22:00:00.000Z"), now)).toBe("Ontem, 19:00");
    expect(dateLabel(new Date("2026-10-01T12:00:00.000Z"), now)).toBe("01/10, 09:00");
  });
});
