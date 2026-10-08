// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: vi.fn() }));
vi.mock("@/features/broker-workspace/components/light-availability-banner", () => ({ LightAvailabilityBanner: () => null }));
// Arc components drive Motion springs that the global jsdom mock of motion/react does not implement.
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, loading: _loading, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));
vi.mock("@/components/arc/empty-state/empty-state", () => ({
  EmptyState: ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
    <section aria-label={title}><h3>{title}</h3><p>{description}</p>{action}</section>
  ),
}));
vi.mock("@/components/arc/metric-card/metric-card", () => ({
  MetricCard: ({ label, value, context }: { label: string; value: number; context: string }) => (
    <article><span>{label}</span><strong>{value}</strong><span>{context}</span></article>
  ),
}));

import { LightAvailabilityProvider } from "@/components/light/light-availability-context";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";

import { formatRemaining, statusSentence } from "./format";
import { LightDashboard } from "./index";

const emptyToday: BrokerWorkspaceData["today"] = {
  awaitingResponse: 0, overdueTasks: 0, returnsDue: 0, newLeads: 0, pendingDocuments: 0, pendingProposals: 0,
  unreadNotifications: 0, receivedToday: 0, acceptedToday: 0, inServiceNow: 0, slaAtRiskNow: 0,
};

function makeData(overrides: Partial<BrokerWorkspaceData> = {}): BrokerWorkspaceData {
  return {
    viewer: { tenantId: "t", userId: "u", name: "Ana Souza", branchName: "Centro", availabilityStatus: "available" },
    nextAction: null,
    duty: null,
    today: emptyToday,
    inbox: [],
    agenda: [],
    queue: [],
    goal: null,
    updatedAt: new Date("2026-10-08T12:00:00Z"),
    ...overrides,
  };
}

const activeDuty = {
  scheduleId: "s1", scheduleName: "Plantão manhã", queueName: "Fila Santos", branchName: "Centro", dutyDate: "2026-10-08",
  startsAt: new Date("2026-10-08T11:00:00Z"), endsAt: new Date("2026-10-08T15:00:00Z"), paused: false,
  presenceStatus: "not_required" as const,
};

afterEach(() => cleanup());

describe("statusSentence and formatRemaining", () => {
  it("says a number only when there is something to count", () => {
    expect(statusSentence(emptyToday)).toBe("Nenhuma pendência agora.");
    expect(statusSentence({ ...emptyToday, newLeads: 1 })).toBe("1 novo lead aguarda seu aceite.");
    expect(statusSentence({ ...emptyToday, newLeads: 3 })).toBe("3 novos leads aguardam seu aceite.");
    expect(statusSentence({ ...emptyToday, newLeads: 3, slaAtRiskNow: 2 })).toMatch(/^2 leads com prazo em risco/);
  });

  it("formats the remaining duty time", () => {
    expect(formatRemaining(40 * 60_000)).toBe("40 min");
    expect(formatRemaining(135 * 60_000)).toBe("2 h 15 min");
    expect(formatRemaining(120 * 60_000)).toBe("2 h");
  });
});

describe("LightDashboard", () => {
  it("greets by first name with one status sentence and no logout or eyebrow of its own", () => {
    render(<LightDashboard data={makeData()} greeting="Bom dia" />);

    expect(screen.getByRole("heading", { level: 1, name: "Bom dia, Ana" })).toBeTruthy();
    expect(screen.getByText("Nenhuma pendência agora.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sair da conta/i })).toBeNull();
  });

  it("shows the plantão card with the status and lets the broker pause", () => {
    const setStatus = vi.fn();
    render(
      <LightAvailabilityProvider value={{ availability: "available", isPending: false, setStatus }}>
        <LightDashboard data={makeData({ duty: { active: activeDuty, next: null, readyToReceive: true } })} greeting="Boa tarde" />
      </LightAvailabilityProvider>,
    );

    const card = screen.getByRole("region", { name: "Plantão agora" });
    expect(within(card).getByText("Plantão manhã")).toBeTruthy();
    expect(within(card).getByText("Pronto para receber")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Pausar" }));
    expect(setStatus).toHaveBeenCalledWith("paused");
  });

  it("shows Retomar when the broker is paused and keeps a roster pause out of their hands", () => {
    const setStatus = vi.fn();
    const { rerender } = render(
      <LightAvailabilityProvider value={{ availability: "paused", isPending: false, setStatus }}>
        <LightDashboard data={makeData({ duty: { active: activeDuty, next: null, readyToReceive: false } })} greeting="Boa noite" />
      </LightAvailabilityProvider>,
    );
    expect(screen.getByText("Pausado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retomar" }));
    expect(setStatus).toHaveBeenCalledWith("available");

    rerender(
      <LightAvailabilityProvider value={{ availability: "available", isPending: false, setStatus }}>
        <LightDashboard data={makeData({ duty: { active: { ...activeDuty, paused: true }, next: null, readyToReceive: false } })} greeting="Boa noite" />
      </LightAvailabilityProvider>,
    );
    expect(screen.getByText("Pausado no plantão")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pausar" })).toBeNull();
  });

  it("shows the next plantão in a neutral card, and nothing when there is none", () => {
    const next = { scheduleName: "Plantão sábado", queueName: "Fila Santos", dutyDate: "2026-10-10", startsAt: new Date("2026-10-10T11:00:00Z"), endsAt: new Date("2026-10-10T15:00:00Z"), paused: false };
    const { unmount } = render(<LightDashboard data={makeData({ duty: { active: null, next, readyToReceive: false } })} greeting="Bom dia" />);
    expect(screen.getByRole("region", { name: "Próximo plantão" })).toBeTruthy();
    unmount();

    render(<LightDashboard data={makeData()} greeting="Bom dia" />);
    expect(screen.queryByText(/plantão/i)).toBeNull();
  });

  it("links the day metrics to the queue tabs and highlights what is at risk", () => {
    render(<LightDashboard data={makeData({ today: { ...emptyToday, receivedToday: 5, acceptedToday: 3, inServiceNow: 2, slaAtRiskNow: 1 } })} greeting="Bom dia" />);

    const day = screen.getByRole("region", { name: "Seu dia" });
    expect(within(day).getAllByRole("listitem")).toHaveLength(4);
    expect(day.querySelector('a[href="/minha-fila?filter=risk"]')).not.toBeNull();
    expect(day.querySelectorAll('a[href="/minha-fila?filter=active"]')).toHaveLength(2);
    expect(within(day).getByText("Peça atenção")).toBeTruthy();
  });

  it("offers a single accept button for a new lead and an empty state when there is nothing to do", () => {
    const nextAction = {
      kind: "new_lead" as const, severity: "warning" as const, leadId: "lead-1", dueAt: null, referenceAt: new Date(),
      title: "Maria Lima", description: "Aguardando seu primeiro contato", href: "/leads/lead-1",
    };
    const { unmount } = render(<LightDashboard data={makeData({ nextAction })} greeting="Bom dia" />);
    const now = screen.getByRole("region", { name: "Faça agora" });
    expect(within(now).getByText("Maria Lima")).toBeTruthy();
    expect(within(now).getByRole("button", { name: "Aceitar lead" })).toBeTruthy();
    unmount();

    render(<LightDashboard data={makeData()} greeting="Bom dia" />);
    expect(screen.getByRole("heading", { name: "Tudo em dia" })).toBeTruthy();
    expect(screen.getByText(/Nenhum compromisso agendado/)).toBeTruthy();
  });
});
