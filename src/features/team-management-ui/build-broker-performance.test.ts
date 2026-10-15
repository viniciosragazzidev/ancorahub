import { describe, expect, it } from "vitest";

import type { TeamMetricBroker, TeamMetricWindow } from "@/features/team-management/metrics";
import { buildBrokerPerformanceView, normalizeBrokerPerformanceWindow } from "./build-broker-performance";

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

const broker: TeamMetricBroker = {
  id: "broker-1",
  name: "Ana",
  image: null,
  supervisorId: "sup-1",
  supervisorName: "Supervisora",
  teamName: "Equipe",
  branchId: "unit-1",
  current: metricWindow({
    received: 20,
    accepted: 16,
    medianAcceptanceSeconds: 65,
    redistributions: 2,
    slaRate: 90,
    quotes: 8,
    sales: 4,
    losses: 1,
    conversion: { received: 15, converted: 5, rate: 33.3 },
  }),
  previous: metricWindow({
    received: 14,
    accepted: 8,
    medianAcceptanceSeconds: 100,
    redistributions: 4,
    slaRate: 75,
    quotes: 5,
    sales: 2,
    losses: 2,
    conversion: { received: 12, converted: 3, rate: 25 },
  }),
  recent3DaysRedistributions: 1,
  previous3DaysRedistributions: 2,
};

describe("montagem do desempenho do corretor a partir do G0", () => {
  it("returns no performance without a broker row", () => {
    expect(buildBrokerPerformanceView(null, { window: 7, teamMedianAcceptSeconds: null })).toBeNull();
  });

  it.each([7, 30] as const)("mounts canonical values and real favorable trends for the %i-day window", (window) => {
    const view = buildBrokerPerformanceView(broker, { window, teamMedianAcceptSeconds: 88 });

    expect(view?.window).toBe(window);
    expect(view?.teamMedianAcceptSeconds).toBe(88);
    expect(view?.items).toHaveLength(8);
    expect(view?.items.map((item) => item.key)).toEqual([
      "accepted", "accept-time", "on-time", "redistributions", "quotes", "sales", "conversion", "losses",
    ]);
    expect(view?.items.map((item) => item.trend)).toEqual([
      "up", "up", "up", "up", "up", "up", "up", "up",
    ]);
    expect(view?.items.find((item) => item.key === "on-time")?.value).toBe("90%");
    expect(view?.items.find((item) => item.key === "conversion")?.value).toBe("33,3%");
  });

  it("defaults invalid URL windows to seven days and accepts thirty", () => {
    expect(normalizeBrokerPerformanceWindow(undefined)).toBe(7);
    expect(normalizeBrokerPerformanceWindow("7")).toBe(7);
    expect(normalizeBrokerPerformanceWindow("30")).toBe(30);
    expect(normalizeBrokerPerformanceWindow(["7", "30"])).toBe(30);
  });
});
