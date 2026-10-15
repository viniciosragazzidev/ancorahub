// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <div role="img" aria-label={name} /> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <section><strong>{title}</strong></section> }));

import { buildUnitOverview, type TeamMetricsInput, type TeamMetricsOverviewInput } from "./build-overview";
import { UnitOverviewView } from "./unit-overview";
import type { TeamMetricBroker, TeamMetricWindow } from "@/features/team-management/metrics";

afterEach(() => cleanup());

const now = new Date("2026-10-15T15:00:00-03:00");
const identity = {
  activeBrokers: 9,
  supervisors: [
    { supervisorId: "sup-ana", name: "Ana", image: null, teamName: "Equipe Centro", brokers: 5 },
    { supervisorId: "sup-bruno", name: "Bruno", image: null, teamName: "Equipe Norte", brokers: 4 },
  ],
  unassigned: [{ userId: "b-1", name: "Diego" }],
};

function metricWindow(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 0,
    accepted: 0,
    acceptanceRate: 0,
    medianAcceptanceSeconds: null,
    redistributions: 0,
    slaRate: 0,
    activeLeads: null,
    overdueReturns: null,
    criticalOverdueReturns: null,
    leadsWithoutNextAction: null,
    quotes: 0,
    sales: 0,
    losses: 0,
    conversion: { received: 0, converted: 0, rate: 0 },
    lastActivityAt: null,
    ...overrides,
  };
}

function makeBroker(id: string, activeLeads: number, lastActivityAt: Date | null): TeamMetricBroker {
  return {
    id,
    name: id,
    image: null,
    supervisorId: id.startsWith("ana") ? "sup-ana" : "sup-bruno",
    supervisorName: null,
    teamName: "Equipe",
    branchId: "unit-1",
    current: metricWindow({ activeLeads, lastActivityAt }),
    previous: metricWindow(),
    recent3DaysRedistributions: 0,
    previous3DaysRedistributions: 0,
  };
}

function teamMetric(input: { current: Partial<TeamMetricWindow>; previous?: Partial<TeamMetricWindow>; brokers: TeamMetricBroker[] }): TeamMetricsInput {
  const supervisorId = input.brokers[0]?.supervisorId ?? null;
  return {
    id: supervisorId ?? "__no_team__",
    name: supervisorId ? "Equipe de teste" : "Sem equipe",
    supervisorId,
    supervisorName: null,
    branchId: "unit-1",
    current: metricWindow(input.current),
    previous: metricWindow(input.previous),
    recent3DaysRedistributions: 0,
    previous3DaysRedistributions: 0,
    brokers: input.brokers,
  };
}

const healthyTeam = teamMetric({
  current: { received: 40, accepted: 40, acceptanceRate: 100, slaRate: 100, activeLeads: 20, conversion: { received: 10, converted: 4, rate: 40 } },
  previous: { received: 30, accepted: 24, acceptanceRate: 80, slaRate: 75, conversion: { received: 10, converted: 2, rate: 20 } },
  brokers: Array.from({ length: 5 }, (_, index) => makeBroker(`ana-${index}`, 4, now)),
});
const criticalTeam = teamMetric({
  current: { received: 40, accepted: 8, acceptanceRate: 20, slaRate: 20, activeLeads: 4, overdueReturns: 5, leadsWithoutNextAction: 3, redistributions: 40, conversion: { received: 10, converted: 0, rate: 0 } },
  previous: { received: 30, accepted: 20, acceptanceRate: 67, slaRate: 70, conversion: { received: 10, converted: 3, rate: 30 } },
  brokers: Array.from({ length: 4 }, (_, index) => makeBroker(`bruno-${index}`, 1, null)),
});
const metrics: TeamMetricsOverviewInput = {
  unit: {
    id: "unit-1",
    name: "Central",
    current: metricWindow({ received: 94, slaRate: 87, acceptanceRate: 84, conversion: { received: 80, converted: 24, rate: 30 } }),
    previous: metricWindow({ received: 79, slaRate: 78, acceptanceRate: 80, conversion: { received: 70, converted: 14, rate: 20 } }),
  },
  unitConversionRate: 30,
  teamsBySupervisorId: new Map([["sup-ana", healthyTeam], ["sup-bruno", criticalTeam]]),
  unassignedTeam: null,
};

describe("UnitOverviewView", () => {
  it("without metrics shows the roster, unavailable values, and no invented score", () => {
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics: null, now })} />);

    expect(screen.getByText("Indicadores de saúde chegam em breve.")).toBeTruthy();
    expect(screen.getAllByText("Indicadores em breve").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Sem dados").length).toBe(4);
    expect(screen.getByRole("heading", { name: "Sem equipe" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Abrir equipe/ })[0]?.getAttribute("href")).toBe("/gestao/equipes/sup-ana");
  });

  it("with metrics shows SLA as a percentage, computed health, and the attention exception", () => {
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics, now })} />);

    expect(screen.getByText("1 equipe precisa de atenção")).toBeTruthy();
    expect(screen.getByText("87%")).toBeTruthy();
    expect(screen.getByText("84%")).toBeTruthy();
    expect(screen.getByText("30%")).toBeTruthy();
    expect(screen.getByText("80")).toBeTruthy();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings[0]).toBe("Equipe Norte");
    expect(screen.getByText("Crítico")).toBeTruthy();
    expect(screen.getByText(/leads sem próxima ação/)).toBeTruthy();
  });

  it("renders the supervisor comparison with a trend and no podium", () => {
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics, now })} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Ana", "Bruno"]);
    expect(within(table).getByText("100")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/pódio/i);
    expect(document.body.textContent).not.toContain("—");
  });

  it("shows the unassigned brokers as a health group when G0 includes it", () => {
    const withUnassigned: TeamMetricsOverviewInput = { ...metrics, unassignedTeam: healthyTeam };
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics: withUnassigned, now })} />);

    expect(screen.getByRole("heading", { name: "Sem equipe" })).toBeTruthy();
    expect(screen.getByText("Diego")).toBeTruthy();
  });

  it("names the unassigned group separately in the exception phrase", () => {
    const withUnassignedAttention: TeamMetricsOverviewInput = { ...metrics, unassignedTeam: criticalTeam };
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics: withUnassignedAttention, now })} />);

    expect(screen.getByText("1 equipe precisa de atenção. O grupo Sem equipe também precisa de atenção.")).toBeTruthy();
  });
});
