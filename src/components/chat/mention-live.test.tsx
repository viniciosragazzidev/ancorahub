// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { ChatScreen } from "./chat-screen";
import type { ChatBlock } from "./types";

const menu = [
  { handle: "block:precisa", label: "@Precisa de você", note: "Leads esperando uma ação sua", group: "atalhos", count: 2, tone: "danger" },
  { handle: "lead:l1", label: "@Maria Souza", note: "Respondeu", group: "leads", initials: "MS" },
];
const leadsBlock: ChatBlock = {
  type: "leads", id: "b1", title: "Precisa de você", icon: "leads", emptyText: "Nada", updatedAt: "10:28",
  rows: [{ leadId: "l1", name: "Maria Souza", initials: "MS", context: "PME · 3 vidas", time: "09:12", chip: { label: "Respondeu", tone: "success" } }],
};
const card: ChatBlock = {
  type: "leadcard", id: "c1", leadId: "l1", name: "Maria Souza", initials: "MS", stage: "Em atendimento",
  alert: { tone: "warning", text: "Sem resposta há 2 dias" }, rows: [{ label: "Tipo", value: "PME · 3 vidas" }],
  whatsappHref: "https://wa.me/5521999999999", href: "/leads/l1", fichaHref: "/leads/l1?ficha=1", updatedAt: "10:28",
};

const fetchMock = vi.fn(async (url: string) => {
  const body = url.includes("menu=1") ? { menu } : url.includes("lead%3Al1") ? { blocks: [card] } : { blocks: [leadsBlock] };
  return { ok: true, json: async () => body } as Response;
});

beforeEach(() => { fetchMock.mockClear(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("@ with live blocks", () => {
  it("opens a grouped menu, brings a live list, and a row opens the lead's quick card", async () => {
    render(<ChatScreen identity={{ name: "Leads", shape: "mochi", hue: 212 }} backHref="/dashboard" script={{ blocks: [] }} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "@" } });

    expect(await screen.findByText("Atalhos")).toBeTruthy();
    expect(screen.getByRole("combobox").getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    expect(screen.getByRole("combobox").getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: /Maria Souza/ }).id);
    expect(screen.getByRole("option", { name: /Maria Souza/ })).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("option", { name: /Precisa de você/ }));

    // One tap: the pick shows as the broker's message, then the live list arrives.
    expect(await screen.findByText("@Precisa de você")).toBeTruthy();
    expect(await screen.findByText("PME · 3 vidas")).toBeTruthy();
    expect(screen.getByText("Atualizado às 10:28")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ver Maria Souza" }));
    expect(await screen.findByText("Sem resposta há 2 dias")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir conversa" }).getAttribute("href")).toBe("/leads/l1");
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toBe("https://wa.me/5521999999999");
    expect(screen.getByRole("link", { name: "Ficha completa" }).getAttribute("href")).toBe("/leads/l1?ficha=1");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/chat/mention?h=lead%3Al1", expect.anything()));
  });

  it("filters the menu without accents", async () => {
    render(<ChatScreen identity={{ name: "Leads", shape: "mochi", hue: 212 }} backHref="/dashboard" script={{ blocks: [] }} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "@voce" } });
    expect(await screen.findByRole("option", { name: /Precisa de você/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Maria/ })).toBeNull();
  });
});
