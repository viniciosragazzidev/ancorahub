// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/plantoes/agora" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname, useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn(), replace: vi.fn() }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { ChatHome } from "./chat-home";
import type { PresenceAskView, ThreadSummary } from "./types";

afterEach(() => cleanup());

const thread = (id: string, name: string, href: string, extra: Partial<ThreadSummary> = {}): ThreadSummary => ({
  id, kind: "assistant", name, preview: `${name} em dia.`, at: null, unread: false, waitingYou: false, href, shape: "mochi", hue: 212, ...extra,
});
const assistants = [thread("assistant:leads", "Leads", "/minha-fila", { assistant: "leads" }), thread("assistant:plantao", "Plantão", "/plantoes/agora", { assistant: "plantao" })];
const leads = [thread("lead:1", "Maria Souza", "/leads/1", { kind: "lead", leadId: "1", waitingYou: true, initials: "MS" })];
const presenceAsk = (assignmentId: string, scheduleName: string, status: PresenceAskView["status"] = "pending"): PresenceAskView => ({
  assignmentId, scheduleName, branchName: "Centro", mode: "online", startsAt: "2026-10-10T09:00:00.000Z", endsAt: "2026-10-10T18:00:00.000Z", status, photoId: null,
});

describe("ChatHome", () => {
  it("groups simultaneous duties with a heading and names, but keeps one ask ungrouped", () => {
    const { rerender } = render(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={[]} nowIso="2026-10-10T12:00:00.000Z" canQuote presenceAsks={[presenceAsk("as-1", "PME Manhã"), presenceAsk("as-2", "Presencial Tarde", "awaiting_release")]}/>);
    expect(screen.getByRole("heading", { level: 2, name: "2 plantões agora" })).toBeTruthy();
    expect(screen.getByText("PME Manhã · Centro")).toBeTruthy();
    expect(screen.getByText("Presencial Tarde · Centro")).toBeTruthy();

    rerender(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={[]} nowIso="2026-10-10T12:00:00.000Z" canQuote presenceAsks={[presenceAsk("as-1", "PME Manhã")]}/>);
    expect(screen.queryByRole("heading", { level: 2, name: "1 plantão agora" })).toBeNull();
    expect(screen.getByText("Confirme sua presença")).toBeTruthy();

    rerender(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={[]} nowIso="2026-10-10T12:00:00.000Z" canQuote presenceAsks={[presenceAsk("as-1", "PME Manhã", "confirmed"), presenceAsk("as-2", "Presencial Tarde", "confirmed")]}/>);
    expect(screen.queryByText("PME Manhã · Centro")).toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "2 plantões agora" })).toBeNull();
  });

  it("rail: keeps the list and marks the conversation open at the center", () => {
    render(<ChatHome mode="rail" viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote />);
    expect(screen.getByRole("link", { name: /Plantão/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /^Leads/ }).getAttribute("aria-current")).toBeNull();
    // The rail is only the list: no day summary, no floating action.
    expect(screen.queryByText("Recebidos hoje")).toBeNull();
  });

  it("shows the manager's waiting unit lead count on the Leads tab", () => {
    render(<ChatHome mode="rail" viewerName="Ana Lima" assistants={assistants} leads={[]} nowIso="2026-10-10T12:00:00.000Z" canQuote={false} leadsBadgeCount={6} />);
    const leadsTab = screen.getByRole("button", { name: /Leads/ });
    expect(leadsTab.textContent).toContain("6");
    fireEvent.click(leadsTab);
    expect(leadsTab.getAttribute("aria-pressed")).toBe("true");
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
        summary={{ receivedToday: 4, acceptedToday: 3, inServiceNow: 2, slaAtRiskNow: 1, duty: { title: "De plantão: PME", detail: "09:00 às 18:00", href: "/plantoes/agora" }, goal: null }}
      />,
    );
    expect(screen.getByText("Recebidos hoje")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText(/Maria está esperando você/)).toBeTruthy();
    expect(screen.getByText("De plantão: PME")).toBeTruthy();
  });

  it("shows the scoped WhatsApp activity on Lite team home and links to filtered conversations", () => {
    navigation.pathname = "/dashboard";
    render(
      <ChatHome
        viewerName="Ana Lima"
        assistants={assistants}
        leads={[]}
        nowIso="2026-10-10T12:00:00.000Z"
        canQuote={false}
        whatsappActivity={{
          connectedBrokerCount: 1,
          totalLeads: 3,
          brokers: [{ id: "broker-1", name: "Carla Costa", leadCount: 3 }],
        }}
        summary={{ receivedToday: 0, acceptedToday: 0, inServiceNow: 0, slaAtRiskNow: 0, duty: null, goal: null }}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "3 leads responderam nos últimos 7 dias" })).toBeTruthy();
    expect(screen.getByText("1 corretor conectado")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Carla Costa, 3 leads" }).getAttribute("href")).toBe("/conversas?tab=leads&brokerId=broker-1&respondeu=7d");
  });

  it("shows the broker's positions and the step mission, but not in the rail", () => {
    navigation.pathname = "/dashboard";
    const highlights = {
      ranks: [{ key: "speed", position: 1, label: "no aceite mais rápido", total: 12 }, { key: "accepted", position: 10, label: "nos que mais aceitam", total: 12 }],
      acceptTime: "1 min 20 s",
      mission: { title: "Registre a etapa de Maria S.", detail: "3 leads ainda sem etapa.", href: "/leads/1" },
    };
    const { unmount } = render(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote highlights={highlights} />);
    // The card shows the best position; tapping it opens the week sheet with every position.
    expect(screen.getAllByText("1º no aceite mais rápido").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Ver sua semana/ })[0]!);
    expect(screen.getByText("À frente de 100% da equipe")).toBeTruthy();
    expect(screen.getByText("10º de 12")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Registre a etapa de Maria S\./ })[0]!.getAttribute("href")).toBe("/leads/1");
    unmount();
    render(<ChatHome mode="rail" viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote highlights={highlights} />);
    expect(screen.queryByText("1º no aceite mais rápido")).toBeNull();
  });

  it("with the journey on but no data yet, says where the ranking will appear", () => {
    navigation.pathname = "/dashboard";
    render(<ChatHome viewerName="Ana Lima" assistants={assistants} leads={leads} nowIso="2026-10-10T12:00:00.000Z" canQuote highlights={{ ranks: [], acceptTime: null, mission: null }} />);
    expect(screen.getAllByText(/Seu ranking aparece depois dos primeiros atendimentos/).length).toBeGreaterThan(0);
  });
});
