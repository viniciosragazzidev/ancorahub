import { describe, expect, it } from "vitest";

import { brokerTeamAlerts, teamAlerts } from "./alerts";
import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "./metrics";

function window(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10,
    accepted: 7,
    acceptanceRate: 70,
    medianAcceptanceSeconds: 60,
    redistributions: 2,
    slaRate: 80,
    slaLeads: 0,activeLeads: 10,
    overdueReturns: 0,
    criticalOverdueReturns: 0,
    leadsWithoutNextAction: 0,
    quotes: 3,
    sales: 1,
    losses: 0,
    conversion: { received: 10, converted: 2, rate: 20 },
    lastActivityAt: new Date("2026-10-15T12:00:00Z"),
    ...overrides,
  };
}

const now = new Date("2026-10-15T15:00:00Z");
const duty = { id: "b1", name: "Ana", dutyStartedAt: new Date("2026-10-15T12:30:00Z"), lastAcceptedAt: null };

function broker(overrides: Partial<TeamMetricBroker> = {}): TeamMetricBroker {
  return {
    id: "b1", name: "Ana", image: null, supervisorId: "s1", supervisorName: "João", teamName: "Equipe Azul", branchId: "u1",
    current: window(), previous: window(), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0,
    ...overrides,
  };
}

describe("brokerTeamAlerts", () => {
  it("returns ready-to-display alerts for every broker rule", () => {
    const member = broker({
      current: window({ activeLeads: 20, leadsWithoutNextAction: 3, conversion: { received: 10, converted: 1, rate: 7 } }),
      previous: window({ conversion: { received: 10, converted: 2, rate: 10 } }),
      recent3DaysRedistributions: 14,
      previous3DaysRedistributions: 10,
    });
    const result = brokerTeamAlerts({ broker: member, now, windowDays: 7, onDuty: duty, teamAverageActiveLeads: 10 });
    expect(result.map((alert) => alert.id)).toEqual(expect.arrayContaining([
      "no_accept_in_duty", "redistributions_rising", "many_without_next_action", "conversion_falling", "overloaded",
    ]));
    expect(result.every((alert) => alert.message.length > 0 && alert.subjectType === "broker")).toBe(true);
  });

  it("does not flag a broker that accepted within the last two hours", () => {
    const acceptedDuty = { ...duty, lastAcceptedAt: new Date("2026-10-15T14:00:00Z") };
    expect(brokerTeamAlerts({ broker: broker(), now, windowDays: 7, onDuty: acceptedDuty, teamAverageActiveLeads: 10 }))
      .not.toContainEqual(expect.objectContaining({ id: "no_accept_in_duty" }));
  });

  it("flags a broker whose last acceptance was at least two hours ago", () => {
    const acceptedDuty = { ...duty, lastAcceptedAt: new Date("2026-10-15T13:00:00Z") };
    expect(brokerTeamAlerts({ broker: broker(), now, windowDays: 7, onDuty: acceptedDuty, teamAverageActiveLeads: 10 }))
      .toContainEqual(expect.objectContaining({ id: "no_accept_in_duty" }));
  });

  it("allows alert thresholds to be configured", () => {
    const result = brokerTeamAlerts({
      broker: broker({ current: window({ leadsWithoutNextAction: 2 }) }),
      now, windowDays: 7, onDuty: null, teamAverageActiveLeads: 0,
      thresholds: { manyWithoutNextAction: 2 },
    });
    expect(result).toContainEqual(expect.objectContaining({ id: "many_without_next_action" }));
  });
});

describe("teamAlerts", () => {
  it("covers team SLA deterioration and accumulated critical returns", () => {
    const members = [
      broker({ id: "b1", name: "Ana", current: window({ activeLeads: 16, leadsWithoutNextAction: 3 }) }),
      broker({ id: "b2", name: "Bia", current: window({ activeLeads: 4 }) }),
    ];
    const team: TeamMetricTeam = {
      id: "s1", name: "Equipe Azul", supervisorId: "s1", supervisorName: "João", branchId: "u1",
      current: window({ slaRate: 60, slaLeads: 0,criticalOverdueReturns: 3, leadsWithoutNextAction: 3, conversion: { received: 10, converted: 1, rate: 7 } }),
      previous: window({ slaRate: 70, slaLeads: 0,conversion: { received: 10, converted: 2, rate: 10 } }),
      recent3DaysRedistributions: 14, previous3DaysRedistributions: 10, brokers: members,
    };
    const result = teamAlerts({ team, now, windowDays: 7, onDutyBrokers: [duty] });
    expect(result.map((alert) => alert.id)).toEqual(expect.arrayContaining([
      "no_accept_in_duty", "redistributions_rising", "many_without_next_action", "conversion_falling",
      "overloaded", "few_leads", "team_sla_worsening", "critical_pending",
    ]));
    expect(result.find((alert) => alert.id === "critical_pending")?.severity).toBe("critical");
    expect(result.every((alert) => alert.message.length > 0 && alert.subjectType === "team")).toBe(true);
  });
});
