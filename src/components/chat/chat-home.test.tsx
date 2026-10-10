// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard/c/plantao" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { ChatHome } from "./chat-home";
import type { ThreadSummary } from "./types";

afterEach(() => cleanup());

const thread = (id: string, name: string, href: string, extra: Partial<ThreadSummary> = {}): ThreadSummary => ({
  id, kind: "assistant", name, preview: `${name} em dia.`, at: null, unread: false, waitingYou: false, href, shape: "mochi", hue: 212, ...extra,
});
const assistants = [thread("assistant:leads", "Leads", "/dashboard/c/leads", { assistant: "leads" }), thread("assistant:plantao", "Plantão", "/dashboard/c/plantao", { assistant: "plantao" })];
const leads = [thread("lead:1", "Maria Souza", "/leads/1", { kind: "lead", leadId: "1", waitingYou: true, initials: "MS" })];

describe("ChatHome", () => {
  it("rail: keeps the list and marks the conversation open at the center", () => {
    render(<ChatHome mode="rail" viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote />);
    expect(screen.getByRole("link", { name: /Plantão/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /^Leads/ }).getAttribute("aria-current")).toBeNull();
    // The rail is only the list: no day summary, no floating action.
    expect(screen.queryByText("Recebidos hoje")).toBeNull();
  });

  it("page: the center shows the day at a glance and who is waiting", () => {
    navigation.pathname = "/dashboard";
    render(
      <ChatHome
        viewerName="Ana Lima"
        assistants={assistants}
        leads={leads}
        nowIso="2026-10-10T12:00:00.000Z"
        canQuote
        summary={{ receivedToday: 4, acceptedToday: 3, inServiceNow: 2, slaAtRiskNow: 1, duty: { title: "De plantão: PME", detail: "09:00 às 18:00", href: "/dashboard/c/plantao" }, goal: null }}
      />,
    );
    expect(screen.getByText("Recebidos hoje")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText(/Maria está esperando você/)).toBeTruthy();
    expect(screen.getByText("De plantão: PME")).toBeTruthy();
  });

  it("shows the broker's positions and the step mission, but not in the rail", () => {
    navigation.pathname = "/dashboard";
    const highlights = {
      ranks: [{ key: "speed", position: 1, label: "no aceite mais rápido", total: 12 }, { key: "accepted", position: 10, label: "nos que mais aceitam", total: 12 }],
      acceptTime: "1 min 20 s",
      mission: { title: "Registre a etapa de Maria S.", detail: "3 leads ainda sem etapa.", href: "/leads/1" },
    };
    const { unmount } = render(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote highlights={highlights} />);
    expect(screen.getAllByText("1º").length).toBeGreaterThan(0);
    expect(screen.getAllByText("no aceite mais rápido · de 12").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Registre a etapa de Maria S\./ })[0]!.getAttribute("href")).toBe("/leads/1");
    unmount();
    render(<ChatHome mode="rail" viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote highlights={highlights} />);
    expect(screen.queryByText("1º")).toBeNull();
  });

  it("with the journey on but no data yet, says where the ranking will appear", () => {
    navigation.pathname = "/dashboard";
    render(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote highlights={{ ranks: [], acceptTime: null, mission: null }} />);
    expect(screen.getAllByText("Seu ranking da semana").length).toBeGreaterThan(0);
  });
});
