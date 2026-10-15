// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <div role="img" aria-label={name} /> }));
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

function brokerOf(id: string, name: string, current: Partial<TeamMetricWindow> = {}): TeamMetricBroker {
  return { id, name, image: null, supervisorId: "sup-1", supervisorName: "Ana", teamName: "Equipe Centro", branchId: "b", current: windowOf(current), previous: windowOf(), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0 };
}

describe("TeamPageViewComponent", () => {
  it("shows the empty state 'Ninguém precisa de você agora' when there is nothing to act on", () => {
    render(<TeamPageViewComponent view={buildTeamPageView({ team: teamWith([brokerOf("a", "Ana Costa")]), unitConversionRate: null, now: NOW, viewer: "supervisor", goal: null })} />);

    expect(screen.getByText("Ninguém precisa de você agora")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Gestão do supervisor" })).toBeNull();
  });

  it("renders one card per broker with the shortcuts, the lead and the manager block only for the gestor", () => {
    const needy = brokerOf("b-1", "Bruno", { leadsWithoutNextAction: 5 });
    const view = buildTeamPageView({
      team: teamWith([needy]), unitConversionRate: 12, now: NOW, viewer: "gestor", goal: { name: "Meta de outubro", percentage: 40, currentValue: "4", targetValue: "10" },
      criticalLeads: new Map([["b-1", { leadId: "lead-7", leadName: "Mariana" }]]),
    });
    render(<TeamPageViewComponent view={view} />);

    const card = screen.getByText("Bruno tem 5 leads sem próxima ação.").closest("li") as HTMLElement;
    expect(within(card).getByRole("link", { name: "Abrir corretor" }).getAttribute("href")).toBe("/equipe/b-1");
    expect(within(card).getByRole("link", { name: "Abrir lead" }).getAttribute("href")).toBe("/leads/lead-7");
    expect(within(card).getByRole("link", { name: "Cobrar" }).getAttribute("href")).toBe("/relacionamento?brokerId=b-1");
    expect(screen.getByRole("heading", { name: "Gestão do supervisor" })).toBeTruthy();  });

  it("has no eyebrow and no 'Destaque' or 'Ponto de atenção' prefixes", () => {
    const { container } = render(<TeamPageViewComponent view={buildTeamPageView({ team: teamWith([brokerOf("a", "Ana Costa")]), unitConversionRate: null, now: NOW, viewer: "gestor", goal: null })} />);

    expect(container.textContent).not.toMatch(/Equipe do supervisor|Minha equipe/);
    expect(container.textContent).not.toMatch(/Destaque:|Ponto de atenção:/);
  });

  it("keeps the copy free of em dashes", () => {
    const { container } = render(<TeamPageViewComponent view={buildTeamPageView({ team: teamWith([brokerOf("a", "Ana Costa")]), unitConversionRate: null, now: NOW, viewer: "gestor", goal: null })} />);

    expect(container.textContent).not.toContain("\u2014");
  });
});
