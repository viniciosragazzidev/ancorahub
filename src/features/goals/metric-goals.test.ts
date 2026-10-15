import { describe, expect, it } from "vitest";

import type { TeamMetricWindow } from "@/features/team-management/metrics";

import { isMetricGoalType, metricGoalProgress } from "./metric-goals";

function window(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10, accepted: 8, acceptanceRate: 80, medianAcceptanceSeconds: 480, redistributions: 0, slaRate: 90,
    activeLeads: 4, overdueReturns: 0, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
    quotes: 6, sales: 1, losses: 1, conversion: { received: 10, converted: 1, rate: 10 }, lastActivityAt: null,
    ...overrides,
  };
}

describe("metas da camada do G0", () => {
  it("counts quotes against the target, capped at 100%", () => {
    expect(metricGoalProgress({ targetType: "quotes_count", targetValue: 8, window: window({ quotes: 6 }) })).toEqual({ current: 6, percentage: 75 });
    expect(metricGoalProgress({ targetType: "quotes_count", targetValue: 4, window: window({ quotes: 6 }) }).percentage).toBe(100);
  });

  it("takes the SLA rate as a percentage of the target", () => {
    expect(metricGoalProgress({ targetType: "sla_rate", targetValue: 95, window: window({ slaRate: 90 }) })).toEqual({ current: 90, percentage: 94.74 });
  });

  it("reads response time in minutes, where lower is better", () => {
    // 480 segundos = 8 min. Meta de 4 min com 8 min de resposta = 50%.
    expect(metricGoalProgress({ targetType: "response_minutes", targetValue: 4, window: window({ medianAcceptanceSeconds: 480 }) })).toEqual({ current: 8, percentage: 50 });
    expect(metricGoalProgress({ targetType: "response_minutes", targetValue: 10, window: window({ medianAcceptanceSeconds: 480 }) }).percentage).toBe(100);
  });

  it("gives zero, not a made-up value, when there is no window or no response data", () => {
    expect(metricGoalProgress({ targetType: "quotes_count", targetValue: 8, window: null })).toEqual({ current: 0, percentage: 0 });
    expect(metricGoalProgress({ targetType: "response_minutes", targetValue: 4, window: window({ medianAcceptanceSeconds: null }) })).toEqual({ current: 0, percentage: 0 });
  });

  it("recognizes only the metric types", () => {
    expect(isMetricGoalType("quotes_count")).toBe(true);
    expect(isMetricGoalType("sales_count")).toBe(false);
  });
});
