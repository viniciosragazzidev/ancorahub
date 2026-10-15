import { describe, expect, it } from "vitest";

import { brokerTeamAlerts } from "./alerts";
import { brokerInsights, pickInsights, teamInsights } from "./insights";
import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "./metrics";

const NOW = new Date("2026-10-15T12:00:00.000Z");

function window(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10, accepted: 8, acceptanceRate: 80, medianAcceptanceSeconds: 100, redistributions: 0, slaRate: 90,
    slaLeads: 0,activeLeads: 4, overdueReturns: 0, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
    quotes: 2, sales: 1, losses: 1, conversion: { received: 10, converted: 1, rate: 10 }, lastActivityAt: NOW,
    ...overrides,
  };
}

function brokerOf(id: string, name: string, current: Partial<TeamMetricWindow> = {}, previous: Partial<TeamMetricWindow> = {}): TeamMetricBroker {
  return { id, name, image: null, supervisorId: "s", supervisorName: "S", teamName: "T", branchId: "b", current: window(current), previous: window(previous), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0 };
}

function teamOf(brokers: TeamMetricBroker[], current: Partial<TeamMetricWindow> = {}, previous: Partial<TeamMetricWindow> = {}): TeamMetricTeam {
  return { id: "t", name: "Equipe", supervisorId: "s", supervisorName: "S", branchId: "b", current: window(current), previous: window(previous), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0, brokers };
}

describe("regra de pendências críticas por corretor (G4)", () => {
  it("creates a critical card phrase with the critical lead attached", () => {
    const alerts = brokerTeamAlerts({
      broker: brokerOf("b-1", "Bruno Lima", { criticalOverdueReturns: 2 }),
      now: NOW, windowDays: 7, onDuty: null, teamAverageActiveLeads: 4,
      criticalLead: { leadId: "lead-7", leadName: "Mariana" },
    });
    const critical = alerts.find((alert) => alert.id === "broker_critical_pending");

    expect(critical?.message).toBe("Bruno Lima tem 2 retornos urgentes vencidos.");
    expect(critical?.severity).toBe("critical");
    expect(critical?.leadId).toBe("lead-7");
    expect(critical?.subjectId).toBe("b-1");
  });

  it("uses the singular for one overdue return and does not fire when there is none", () => {
    const one = brokerTeamAlerts({ broker: brokerOf("b-1", "Ana", { criticalOverdueReturns: 1 }), now: NOW, windowDays: 7, onDuty: null, teamAverageActiveLeads: 4 });
    const none = brokerTeamAlerts({ broker: brokerOf("b-2", "Beto", { criticalOverdueReturns: 0 }), now: NOW, windowDays: 7, onDuty: null, teamAverageActiveLeads: 4 });

    expect(one.find((alert) => alert.id === "broker_critical_pending")?.message).toBe("Ana tem 1 retorno urgente vencido.");
    expect(none.some((alert) => alert.id === "broker_critical_pending")).toBe(false);
  });
});

describe("insights em frase (G4)", () => {
  it("says how much the broker reduced the acceptance time", () => {
    const insights = brokerInsights({
      broker: brokerOf("m", "Maria Souza", { medianAcceptanceSeconds: 68 }, { medianAcceptanceSeconds: 100 }),
      brokers: [],
    });

    expect(insights.map((item) => item.message)).toEqual(["Maria reduziu o tempo de aceite em 32%."]);
  });

  it("says when a broker has more redistributions than 90% of the team", () => {
    const others = Array.from({ length: 9 }, (_, index) => brokerOf(`o${index}`, `Outro ${index}`, { redistributions: 1 }));
    const carlos = brokerOf("c", "Carlos Mota", { redistributions: 5 });
    const insights = brokerInsights({ broker: carlos, brokers: [carlos, ...others] });

    expect(insights.map((item) => item.message)).toContain("Carlos tem mais redistribuições que 90% da equipe.");
  });

  it("says the team received more leads than the previous week, only past the threshold", () => {
    const up = teamInsights({ team: teamOf([], { received: 124 }, { received: 100 }), windowDays: 7 });
    const small = teamInsights({ team: teamOf([], { received: 110 }, { received: 100 }), windowDays: 7 });

    expect(up.map((item) => item.message)).toEqual(["A equipe recebeu 24% mais leads que na semana anterior."]);
    expect(small).toEqual([]);
  });

  it("keeps at most three on screen, the biggest movements first", () => {
    const many = [
      { id: "a", subjectType: "team" as const, subjectId: "t", tone: "positive" as const, message: "a", weight: 10 },
      { id: "b", subjectType: "team" as const, subjectId: "t", tone: "positive" as const, message: "b", weight: 40 },
      { id: "c", subjectType: "broker" as const, subjectId: "x", tone: "attention" as const, message: "c", weight: 25 },
      { id: "d", subjectType: "broker" as const, subjectId: "y", tone: "positive" as const, message: "d", weight: 5 },
    ];

    expect(pickInsights(many).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });
});
