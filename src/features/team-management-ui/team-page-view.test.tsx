// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title, description }: { title: string; description: string }) => <section><strong>{title}</strong><p>{description}</p></section> }));

import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "@/features/team-management/metrics";

import { buildTeamPageView } from "./team-page";
import { TeamPageViewComponent } from "./team-page-view";

afterEach(() => cleanup());

const NOW = new Date("2026-10-15T12:00:00.000Z");

function windowOf(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10, accepted: 8, acceptanceRate: 80, medianAcceptanceSeconds: 60, redistributions: 0, slaRate: 90,
    activeLeads: 4, overdueReturns: 0, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
    quotes: 2, sales: 1, losses: 1, conversion: { received: 10, converted: 1, rate: 10 }, lastActivityAt: NOW,
    ...overrides,
  };
}

function teamWith(brokers: TeamMetricBroker[]): TeamMetricTeam {
  return {
    id: "t", name: "Equipe Centro", supervisorId: "sup-1", supervisorName: "Ana", branchId: "b", current: windowOf(), previous: windowOf(),
    recent3DaysRedistributions: 0, previous3DaysRedistributions: 0, brokers,
  };
}

const quietBroker: TeamMetricBroker = { id: "a", name: "Ana Costa", image: null, supervisorId: "sup-1", supervisorName: "Ana", teamName: "Equipe Centro", branchId: "b", current: windowOf(), previous: windowOf(), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0 };

describe("TeamPageViewComponent", () => {
  it("shows the empty state 'Ninguém precisa de você agora' when there is nothing to act on", () => {
    render(<TeamPageViewComponent view={buildTeamPageView({ team: teamWith([quietBroker]), unitCurrent: null, now: NOW, viewer: "supervisor", goal: null })} />);

    expect(screen.getByText("Ninguém precisa de você agora")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Gestão do supervisor" })).toBeNull();
  });

  it("lists the attention cards with their shortcuts and the manager block only for the gestor", () => {
    const needy: TeamMetricBroker = { ...quietBroker, id: "b-1", name: "Bruno", current: windowOf({ leadsWithoutNextAction: 5 }) };
    render(<TeamPageViewComponent view={buildTeamPageView({ team: teamWith([needy]), unitCurrent: null, now: NOW, viewer: "gestor", goal: { name: "Meta de outubro", percentage: 40, currentValue: "4", targetValue: "10" } })} />);

    const card = screen.getByText(/Bruno tem 5 leads sem próxima ação/).closest("li") as HTMLElement;
    expect(within(card).getByRole("link", { name: "Abrir corretor" }).getAttribute("href")).toBe("/equipe/b-1");
    expect(within(card).getByRole("link", { name: "Cobrar" }).getAttribute("href")).toBe("/relacionamento?brokerId=b-1");
    expect(screen.getByRole("heading", { name: "Gestão do supervisor" })).toBeTruthy();
    expect(screen.getByText("Meta de outubro")).toBeTruthy();
  });

  it("keeps the copy free of em dashes", () => {
    const { container } = render(<TeamPageViewComponent view={buildTeamPageView({ team: teamWith([quietBroker]), unitCurrent: null, now: NOW, viewer: "gestor", goal: null })} />);

    expect(container.textContent).not.toContain("—");
  });
});
