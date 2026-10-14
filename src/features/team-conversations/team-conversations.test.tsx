// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamConversationsList } from "./team-conversations-list";
import { TeamConversationView } from "./team-conversation-view";
import { canReadTeamConversations, isOutgoingDirection } from "./direction";

afterEach(() => cleanup());

const now = new Date().toISOString();
const conversations = [
  { leadId: "l1", leadName: "Carla Souza", brokerId: "b1", brokerName: "Paulo Dias", lastBody: "Tem plano para 2 pessoas?", lastAt: now, lastFromClient: true, lastByAi: false, messages: 4 },
  { leadId: "l2", leadName: "Bruno Lima", brokerId: "b2", brokerName: "Ana Reis", lastBody: "Te mando a cotação já", lastAt: now, lastFromClient: false, lastByAi: false, messages: 9 },
];

describe("team conversations scope", () => {
  it("only managers and supervisors read their brokers' conversations here", () => {
    expect(canReadTeamConversations({ role: "manager" })).toBe(true);
    expect(canReadTeamConversations({ role: "supervisor" })).toBe(true);
    expect(canReadTeamConversations({ role: "broker" })).toBe(false);
    expect(canReadTeamConversations({ role: "director" })).toBe(false);
  });

  it("treats every provider spelling of our side as outgoing", () => {
    for (const value of ["outbound", "outgoing", "output"]) expect(isOutgoingDirection(value)).toBe(true);
    for (const value of ["inbound", "incoming", "input"]) expect(isOutgoingDirection(value)).toBe(false);
  });
});

describe("TeamConversationsList", () => {
  it("shows the unit numbers, who waits for an answer and opens the conversation", () => {
    render(<TeamConversationsList conversations={conversations} scopeLabel="unidade" />);
    expect(screen.getByRole("heading", { name: "Mensagens da unidade" })).toBeTruthy();
    expect(screen.getByText("Cliente: Tem plano para 2 pessoas?")).toBeTruthy();
    expect(screen.getByText("Corretor: Te mando a cotação já")).toBeTruthy();
    expect(screen.getByText("Carla Souza").closest("a")?.getAttribute("href")).toBe("/mensagens/l1");
  });

  it("filters to clients waiting and searches by broker", () => {
    render(<TeamConversationsList conversations={conversations} scopeLabel="equipe" />);
    fireEvent.click(screen.getByRole("button", { name: /Cliente esperando/ }));
    expect(screen.queryByText("Bruno Lima")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Todas/ }));
    fireEvent.change(screen.getByLabelText("Buscar por cliente ou corretor"), { target: { value: "ana reis" } });
    expect(screen.getByText("Bruno Lima")).toBeTruthy();
    expect(screen.queryByText("Carla Souza")).toBeNull();
  });
});

describe("TeamConversationView", () => {
  it("shows the chat read only, with who wrote each message", () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(<TeamConversationView conversation={{ leadId: "l1", leadName: "Carla Souza", brokerName: "Paulo Dias", messages: [
      { id: "m1", body: "Oi, quero um plano", at: now, fromClient: true, byAi: false, mediaKind: null },
      { id: "m2", body: "Claro! Quantas vidas?", at: now, fromClient: false, byAi: true, mediaKind: null },
    ] }} />);
    expect(screen.getByText("Atendido por Paulo Dias")).toBeTruthy();
    expect(screen.getByText(/Somente leitura/)).toBeTruthy();
    expect(screen.getByText("IA")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver lead" }).getAttribute("href")).toBe("/leads/l1");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
