import { describe, expect, it } from "vitest";

import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "./metrics";
import { isInactiveForTwoBusinessDays, teamHealthInputFor } from "./health-input";

// Quarta-feira, 15/10/2026 ao meio-dia UTC (09:00 em São Paulo).
const NOW = new Date("2026-10-15T12:00:00.000Z");

function window(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10, accepted: 8, acceptanceRate: 80, medianAcceptanceSeconds: 60, redistributions: 0, slaRate: 90,
    slaLeads: 0,activeLeads: 4, overdueReturns: 0, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
    quotes: 2, sales: 1, losses: 1, conversion: { received: 10, converted: 1, rate: 10 }, lastActivityAt: NOW,
    ...overrides,
  };
}

function brokerWith(current: Partial<TeamMetricWindow>): TeamMetricBroker {
  return { id: "a", name: "Ana", image: null, supervisorId: "s", supervisorName: "S", teamName: "T", branchId: "b", current: window(current), previous: window(), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0 };
}

function teamOf(brokers: TeamMetricBroker[]): TeamMetricTeam {
  return { id: "t", name: "T", supervisorId: "s", supervisorName: "S", branchId: "b", current: window(), previous: window(), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0, brokers };
}

describe("dias úteis em São Paulo", () => {
  it("counts two business days, skipping the weekend", () => {
    expect(isInactiveForTwoBusinessDays(new Date("2026-10-09T15:00:00.000Z"), new Date("2026-10-13T12:00:00.000Z"))).toBe(true);
    expect(isInactiveForTwoBusinessDays(new Date("2026-10-14T15:00:00.000Z"), NOW)).toBe(false);
    expect(isInactiveForTwoBusinessDays(null, NOW)).toBe(true);
  });

  it("uses the São Paulo calendar day, not the UTC one", () => {
    // 13/10 02:00 UTC é segunda 12/10 23:00 em São Paulo. Até quarta 14/10 09:00 já são dois dias úteis.
    expect(isInactiveForTwoBusinessDays(new Date("2026-10-13T02:00:00.000Z"), new Date("2026-10-14T12:00:00.000Z"))).toBe(true);
  });
});

describe("entrada da saúde da equipe", () => {
  it("uses the unit conversion reference when the G0 gives one", () => {
    const input = teamHealthInputFor(teamOf([brokerWith({})]), 20, NOW);

    expect(input.unitAverageConversionRate).toBe(20);
  });

  it("falls back to the team's own conversion when there is no unit reference", () => {
    const input = teamHealthInputFor(teamOf([brokerWith({})]), null, NOW);

    expect(input.unitAverageConversionRate).toBe(10);
  });

  it("counts brokers active within two business days", () => {
    const input = teamHealthInputFor(teamOf([brokerWith({}), brokerWith({ lastActivityAt: new Date("2026-10-01T12:00:00.000Z") })]), null, NOW);

    expect(input.brokersActiveWithinTwoBusinessDays).toBe(1);
    expect(input.activeBrokers).toBe(2);
  });
});
