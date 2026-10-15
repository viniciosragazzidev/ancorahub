// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigation.push }),
  usePathname: () => "/equipe/broker-1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/supervisor-workspace/notes-actions", () => ({ addSupervisorNoteAction: vi.fn() }));
vi.mock("@/features/supervisor-workspace/my-team-actions", () => ({ removeBrokerFromMyTeamAction: vi.fn() }));
vi.mock("@/features/journey/recognition-actions", () => ({ recognizeBrokerAction: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <div role="img" aria-label={name} /> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: () => null }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({ default: () => null }));
vi.mock("@/components/arc/textarea/textarea", () => ({ Textarea: () => null }));
vi.mock("@/components/arc/action-button/action-button", () => ({ ActionButton: () => null }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title, description }: { title: string; description: string }) => <section><strong>{title}</strong><p>{description}</p></section> }));

import { BrokerPerformanceSection, SupervisorBrokerProfile, SupervisorNoteHistory, type BrokerPerformanceView, type SupervisorBrokerProfileProps } from "./supervisor-broker-profile";

afterEach(() => { cleanup(); navigation.push.mockClear(); });

const performance: BrokerPerformanceView = {
  window: 7,
  items: [
    { key: "accepted", label: "Aceites", value: "9", trend: "up", better: "up" },
    { key: "accept-time", label: "Tempo mediano para aceitar", value: "1 min 20 s", trend: "down", better: "down" },
    { key: "on-time", label: "Primeiro contato no prazo", value: "80%", trend: "down", better: "up" },
    { key: "flat", label: "Estável", value: "2", trend: "flat", better: "up" },
  ],
};

describe("BrokerPerformanceSection", () => {
  it("renders the items the parent passes, without fetching anything", () => {
    render(<BrokerPerformanceSection performance={performance} />);

    expect(screen.getByText("Aceites")).toBeTruthy();
    expect(screen.getByText("1 min 20 s")).toBeTruthy();
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("colors the arrow by the good direction: a drop in accept time is an improvement", () => {
    render(<BrokerPerformanceSection performance={performance} />);

    // "Aceites" (up, better up) and "Tempo mediano" (down, better down) both improved; "No prazo" (down, better up) got worse.
    expect(screen.getAllByLabelText("Melhorou", { selector: "span" })).toHaveLength(2);
    expect(screen.getByLabelText("Piorou", { selector: "span" }).textContent).toBe("↓");
    expect(screen.getByLabelText("Estável").textContent).toBe("→");
  });

  it("disables the 30 days switch when the parent gives no way to change the window", () => {
    render(<BrokerPerformanceSection performance={performance} />);

    expect((screen.getByRole("button", { name: "7 dias" }) as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "30 dias" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks the parent for the other window when it is provided", () => {
    const onWindowChange = vi.fn();
    render(<BrokerPerformanceSection performance={performance} onWindowChange={onWindowChange} />);

    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    expect(onWindowChange).toHaveBeenCalledWith(30);
  });

  it("shows an empty state when there is no performance data yet", () => {
    render(<BrokerPerformanceSection performance={null} />);

    expect(screen.getByText("Sem dados de desempenho")).toBeTruthy();
  });
});

describe("SupervisorNoteHistory follow-up", () => {
  it("shows the review day in São Paulo time and flags a past one as overdue", () => {
    render(
      <SupervisorNoteHistory
        notes={[
          { id: "n-late", kind: "melhoria", body: "Usar o roteiro de qualificação.", createdAt: "2026-10-10T12:00:00.000Z", followUpAt: "2020-10-22T03:00:00.000Z" },
          { id: "n-future", kind: "acompanhamento", body: "Ver a cotação da semana.", createdAt: "2026-10-10T12:00:00.000Z", followUpAt: "2099-10-22T03:00:00.000Z" },
        ]}
      />,
    );

    expect(screen.getByText("Ponto de melhoria")).toBeTruthy();
    expect(screen.getByText("Acompanhamento")).toBeTruthy();
    expect(screen.getByText("Revisar em 22/10 · vencido")).toBeTruthy();
    expect(screen.getByText("Revisar em 22/10")).toBeTruthy();
  });

  it("omits the review line when the note has no follow-up date", () => {
    render(<SupervisorNoteHistory notes={[{ id: "n-1", kind: "elogio", body: "Boa condução.", createdAt: "2026-10-10T12:00:00.000Z", followUpAt: null }]} />);

    expect(screen.queryByText(/Revisar em/)).toBeNull();
  });
});

const baseProfile: SupervisorBrokerProfileProps = {
  member: { userId: "broker-1", name: "Ana Souza", image: null, branchName: "Centro", availabilityStatus: "on_duty" },
  metrics: { portfolio: 12, inService: 4, withoutFirstContact: 0, sales: 0, overdueTasks: 2 },
  recentLeads: [],
  whatsappHref: null,
  relationshipHref: "/relacionamento",
  ranking: null,
  notes: [],
};

describe("SupervisorBrokerProfile situation and recognitions", () => {
  it("hides the plantão row when the viewer does not see the roster (gestor)", () => {
    render(<SupervisorBrokerProfile {...baseProfile} situation={{ dutyToday: undefined, newLeads: 0, nextTask: null }} />);

    expect(screen.queryByText("Plantão de hoje")).toBeNull();
    expect(screen.getByText("Nenhuma tarefa aberta")).toBeTruthy();
  });

  it("says there is no plantão today when the roster has no entry for the broker", () => {
    render(<SupervisorBrokerProfile {...baseProfile} situation={{ dutyToday: null, newLeads: 0, nextTask: null }} />);

    expect(screen.getByText("Sem plantão hoje")).toBeTruthy();
  });

  it("shows the plantão with its presence and the next task with its lead", () => {
    render(
      <SupervisorBrokerProfile
        {...baseProfile}
        situation={{
          dutyToday: { scheduleName: "Manhã", startsAt: "08:00", endsAt: "12:00", paused: false, presence: "confirmed" },
          newLeads: 3,
          nextTask: { title: "Ligar de volta", dueAt: "2099-10-16T12:00:00.000Z", leadId: "lead-9", leadName: "Carlos Lima" },
        }}
      />,
    );

    expect(screen.getByText("Manhã · 08:00 às 12:00 · presença confirmada")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ligar de volta" }).getAttribute("href")).toBe("/leads/lead-9");
    expect(screen.getByText(/Vence em/)).toBeTruthy();
  });

  it("lists the recognitions received with their points", () => {
    render(
      <SupervisorBrokerProfile
        {...baseProfile}
        recognitions={[{ id: "r-1", points: 15, reason: "Virada de meta", occurredAt: "2026-10-12T15:00:00.000Z" }]}
      />,
    );

    expect(screen.getByText("+15 pts")).toBeTruthy();
    expect(screen.getByText("Virada de meta")).toBeTruthy();
  });

  it("does not render an em dash in the new copy", () => {
    const { container } = render(<SupervisorBrokerProfile {...baseProfile} situation={{ dutyToday: null, newLeads: 0, nextTask: null }} performance={performance} />);

    expect(container.textContent).not.toContain("—");
  });

  it("changes the URL window so the server can load the selected G0 period", () => {
    render(<SupervisorBrokerProfile {...baseProfile} performance={performance} />);

    fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
    expect(navigation.push).toHaveBeenCalledWith("/equipe/broker-1?janela=30", { scroll: false });
  });
});

describe("SupervisorBrokerProfile WhatsApp connection", () => {
  it("shows the connection date when the broker's WhatsApp is connected", () => {
    render(<SupervisorBrokerProfile {...baseProfile} situation={{ dutyToday: undefined, newLeads: 0, nextTask: null, whatsapp: { connected: true, connectedAt: "2026-09-01T15:00:00.000Z" } }} />);

    expect(screen.getByText("Conectado desde 01/09/2026")).toBeTruthy();
    expect(screen.queryByText(/não conectado/)).toBeNull();
  });

  it("flags in alert when the broker's WhatsApp is not connected", () => {
    render(<SupervisorBrokerProfile {...baseProfile} situation={{ dutyToday: undefined, newLeads: 0, nextTask: null, whatsapp: { connected: false, connectedAt: null } }} />);

    const alert = screen.getByText(/WhatsApp não conectado/);
    expect(alert.getAttribute("data-alert")).toBe("true");
    expect(alert.textContent).toContain("a partir de 20/10");
  });

  it("hides the WhatsApp row when the viewer is outside the broker's scope", () => {
    render(<SupervisorBrokerProfile {...baseProfile} situation={{ dutyToday: undefined, newLeads: 0, nextTask: null, whatsapp: null }} />);

    expect(screen.queryByText("WhatsApp")).toBeNull();
  });
});
