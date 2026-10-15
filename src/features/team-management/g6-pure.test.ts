import { describe, expect, it } from "vitest";
import type { TeamMetricBroker } from "./metrics";
import {
  buildWeeklyHighlights,
  isMissingBrokerMetricDailyTable,
  isMondayMorningInSaoPaulo,
  isNightlySnapshotWindowInSaoPaulo,
  monthlyBrokerMetricTimeline,
  runG6LockedWork,
  saoPauloDayKey,
} from "./g6-pure";

function broker(id: string, name: string, overrides: Partial<TeamMetricBroker["current"]> = {}): TeamMetricBroker {
  const current: TeamMetricBroker["current"] = {
    received: 10, accepted: 7, acceptanceRate: 70, medianAcceptanceSeconds: null, redistributions: 2,
    slaRate: 80, slaLeads: 10, activeLeads: 3, overdueReturns: 0, criticalOverdueReturns: 0,
    leadsWithoutNextAction: 0, quotes: 0, sales: 0, losses: 0,
    conversion: { received: 5, converted: 2, rate: 40 }, lastActivityAt: null, ...overrides,
  };
  return {
    id, name, image: null, supervisorId: "sup-1", supervisorName: "Sup", teamName: "Equipe",
    branchId: "unit-1", current, previous: current, recent3DaysRedistributions: 0, previous3DaysRedistributions: 0,
  };
}

describe("G6 team highlights", () => {
  it("selects weekly category winners and takes evolution from journey ranking movement", () => {
    const rows = [
      broker("a", "Ana", { conversion: { received: 5, converted: 2, rate: 40 }, slaRate: 90, redistributions: 1 }),
      broker("b", "Bia", { conversion: { received: 10, converted: 8, rate: 80 }, slaRate: 99, redistributions: 0 }),
      broker("c", "Caio", { slaLeads: 0, received: 0 }),
    ];
    expect(buildWeeklyHighlights(rows, [{ brokerId: "a", positionChange: 2 }, { brokerId: "b", positionChange: 1 }])).toEqual([
      { category: "conversion", label: "Maior conversão", brokerId: "b", brokerName: "Bia", value: "80%" },
      { category: "sla", label: "Melhor SLA", brokerId: "b", brokerName: "Bia", value: "99%" },
      { category: "evolution", label: "Maior evolução", brokerId: "a", brokerName: "Ana", value: "2 posições no ranking da jornada" },
      { category: "redistributions", label: "Menos redistribuições", brokerId: "b", brokerName: "Bia", value: "0 redistribuições" },
    ]);
  });

  it("does not invent winners when the broker has no observations or no ranking movement", () => {
    const empty = broker("a", "Ana", { received: 0, slaLeads: 0, conversion: { received: 0, converted: 0, rate: 0 } });
    expect(buildWeeklyHighlights([empty], [{ brokerId: "a", positionChange: 0 }])).toEqual([]);
  });
});

describe("G6 monthly snapshot helpers", () => {
  it("keeps the last canonical snapshot of each month", () => {
    expect(monthlyBrokerMetricTimeline([
      { snapshotDay: "2026-01-02", metrics: { "commercial.conversion_rate": 30, "commercial.leads_received": 10, "commercial.leads_converted": 3 } },
      { snapshotDay: "2026-01-31", metrics: { "commercial.conversion_rate": 40, "commercial.leads_received": 5, "commercial.leads_converted": 2 } },
      { snapshotDay: "2026-02-03", metrics: { "commercial.conversion_rate": null, "commercial.leads_received": null, "commercial.leads_converted": null } },
    ])).toEqual([
      { month: "2026-01", conversionRate: 40, leadsReceived: 5, leadsConverted: 2 },
      { month: "2026-02", conversionRate: null, leadsReceived: null, leadsConverted: null },
    ]);
  });

  it("uses Sao Paulo job time and treats a missing migration as an optional section", () => {
    expect(saoPauloDayKey(new Date("2026-10-15T02:30:00.000Z"))).toBe("2026-10-14");
    expect(isMondayMorningInSaoPaulo(new Date("2026-10-19T11:00:00.000Z"))).toBe(true);
    expect(isNightlySnapshotWindowInSaoPaulo(new Date("2026-10-15T05:30:00.000Z"))).toBe(true);
    expect(isMissingBrokerMetricDailyTable({ code: "42P01" })).toBe(true);
    expect(isMissingBrokerMetricDailyTable({ code: "42501" })).toBe(false);
  });

  it("skips a locked duplicate and runs work only for the acquired lock", async () => {
    let calls = 0;
    expect(await runG6LockedWork(async () => false, async () => { calls += 1; return "done"; })).toEqual({ skipped: true });
    expect(await runG6LockedWork(async () => true, async () => { calls += 1; return "done"; })).toEqual({ skipped: false, value: "done" });
    expect(calls).toBe(1);
  });
});
