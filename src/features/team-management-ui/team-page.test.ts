import { describe, expect, it } from "vitest";

import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "@/features/team-management/metrics";

import { buildManagerBlock, buildTeamPageView, isInactiveForTwoBusinessDays, nobodyNeedsYou, sortAttentionAlerts, teamHealthInputFor } from "./team-page";
import type { TeamAlert } from "@/features/team-management/alerts";
import { resolveTeamPageAccess } from "./team-page-access";

// Quarta-feira, 15/10/2026 ao meio-dia UTC.
const NOW = new Date("2026-10-15T12:00:00.000Z");

function window(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10, accepted: 8, acceptanceRate: 80, medianAcceptanceSeconds: 60, redistributions: 0, slaRate: 90,
    activeLeads: 4, overdueReturns: 0, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
    quotes: 2, sales: 1, losses: 1, conversion: { received: 10, converted: 1, rate: 10 }, lastActivityAt: NOW,
    ...overrides,
  };
}

function broker(id: string, overrides: { current?: Partial<TeamMetricWindow>; previous?: Partial<TeamMetricWindow> } = {}): TeamMetricBroker {
  return {
    id, name: `Corretor ${id}`, image: null, supervisorId: "sup-1", supervisorName: "Ana", teamName: "Equipe Centro", branchId: "branch-1",
    current: window(overrides.current), previous: window(overrides.previous),
    recent3DaysRedistributions: 0, previous3DaysRedistributions: 0,
  };
}

function team(brokers: TeamMetricBroker[], overrides: Partial<TeamMetricTeam> = {}): TeamMetricTeam {
  return {
    id: "team-1", name: "Equipe Centro", supervisorId: "sup-1", supervisorName: "Ana", branchId: "branch-1",
    current: window(), previous: window(), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0,
    brokers, ...overrides,
  };
}

describe("ordenação dos alertas por severidade", () => {
  it("puts critical first, then warning, then info, keeping the G0 order inside each severity", () => {
    const alerts: TeamAlert[] = [
      { id: "few_leads", severity: "info", message: "a", subjectId: "1", subjectType: "broker" },
      { id: "overloaded", severity: "warning", message: "b", subjectId: "2", subjectType: "broker" },
      { id: "critical_pending", severity: "critical", message: "c", subjectId: "t", subjectType: "team" },
      { id: "conversion_falling", severity: "warning", message: "d", subjectId: "3", subjectType: "broker" },
    ];

    expect(sortAttentionAlerts(alerts).map((alert) => alert.message)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("carga da equipe e aviso de quem passa de 50% acima da média", () => {
  it("flags only the broker whose active leads pass 50% above the team average", () => {
    const view = buildTeamPageView({
      team: team([
        broker("a", { current: { activeLeads: 4 } }),
        broker("b", { current: { activeLeads: 4 } }),
        broker("c", { current: { activeLeads: 9 } }),
      ]),
      unitCurrent: null, now: NOW, viewer: "supervisor", goal: null,
    });

    expect(view.load.average).toBeCloseTo(5.67, 1);
    expect(view.load.brokers.map((item) => [item.id, item.overThreshold])).toEqual([["a", false], ["b", false], ["c", true]]);
  });
});

describe("estado vazio 'Ninguém precisa de você agora'", () => {
  it("is shown when the team has no alert at all", () => {
    const view = buildTeamPageView({ team: team([broker("a"), broker("b")]), unitCurrent: null, now: NOW, viewer: "supervisor", goal: null });

    expect(view.attention).toEqual([]);
    expect(nobodyNeedsYou(view)).toBe(true);
  });

  it("is not shown when a broker needs attention", () => {
    const view = buildTeamPageView({
      team: team([broker("a", { current: { leadsWithoutNextAction: 5 } }), broker("b")]),
      unitCurrent: null, now: NOW, viewer: "supervisor", goal: null,
    });

    expect(nobodyNeedsYou(view)).toBe(false);
    expect(view.attention[0]?.links.map((link) => link.href)).toEqual(["/equipe/a", "/relacionamento?brokerId=a"]);
  });
});

describe("dias úteis sem atividade", () => {
  it("counts two business days, skipping the weekend", () => {
    // Sexta 09/10 até terça 13/10 tem dois dias úteis (segunda e terça): sem atividade.
    expect(isInactiveForTwoBusinessDays(new Date("2026-10-09T15:00:00.000Z"), new Date("2026-10-13T12:00:00.000Z"))).toBe(true);
    // Quarta 14/10 até quinta 15/10 tem só um dia útil: ainda dentro da janela.
    expect(isInactiveForTwoBusinessDays(new Date("2026-10-14T15:00:00.000Z"), NOW)).toBe(false);
    expect(isInactiveForTwoBusinessDays(null, NOW)).toBe(true);
  });
});

describe("gestão do supervisor (bloco extra do gestor)", () => {
  it("lists brokers below the acceptance average, evolving, without activity and with critical pending", () => {
    const block = buildManagerBlock([
      broker("a", { current: { acceptanceRate: 40, received: 5 } }),
      broker("b", { current: { acceptanceRate: 90, received: 5 } }),
      broker("c", { current: { conversion: { received: 10, converted: 3, rate: 30 } }, previous: { conversion: { received: 10, converted: 1, rate: 10 } } }),
      broker("d", { current: { lastActivityAt: new Date("2026-10-01T12:00:00.000Z"), criticalOverdueReturns: 2 } }),
    ], NOW);

    expect(block.belowAverage).toEqual(["Corretor a"]);
    expect(block.evolving).toEqual(["Corretor c"]);
    expect(block.noActivity).toEqual(["Corretor d"]);
    expect(block.criticalPending).toEqual(["Corretor d"]);
  });

  it("is present only for the gestor view", () => {
    const input = { team: team([broker("a")]), unitCurrent: null, now: NOW, goal: null };

    expect(buildTeamPageView({ ...input, viewer: "gestor" }).managerBlock).not.toBeNull();
    expect(buildTeamPageView({ ...input, viewer: "supervisor" }).managerBlock).toBeNull();
  });
});

describe("saúde e entrada do G0", () => {
  it("uses the G0 score and maps the unit average only for the gestor", () => {
    const t = team([broker("a")]);
    const gestorInput = teamHealthInputFor(t, window({ conversion: { received: 10, converted: 2, rate: 20 } }), NOW);
    const supervisorInput = teamHealthInputFor(t, null, NOW);

    expect(gestorInput.unitAverageConversionRate).toBe(20);
    expect(supervisorInput.unitAverageConversionRate).toBe(10);
    expect(gestorInput.brokersActiveWithinTwoBusinessDays).toBe(1);
  });

  it("shows the trend of the KPIs as the favorable direction", () => {
    const view = buildTeamPageView({
      team: team([broker("a")], { current: window({ slaRate: 95 }), previous: window({ slaRate: 80 }) }),
      unitCurrent: null, now: NOW, viewer: "supervisor", goal: null,
    });

    expect(view.kpis.find((kpi) => kpi.key === "sla")?.trend).toBe("up");
  });
});

describe("acesso à página da equipe", () => {
  const base = { flagOn: true, role: "manager", audience: "manager" as const, requestedSupervisorId: "sup-1", viewerUserId: "mgr-1", teamFound: true, teamInViewerUnit: true };

  it("is not found while the flag is off", () => {
    expect(resolveTeamPageAccess({ ...base, flagOn: false })).toBe("off");
  });

  it("opens any team of the manager's own unit and returns not found for another unit or a missing team", () => {
    expect(resolveTeamPageAccess(base)).toBe("render");
    expect(resolveTeamPageAccess({ ...base, teamInViewerUnit: false })).toBe("notFound");
    expect(resolveTeamPageAccess({ ...base, teamFound: false })).toBe("notFound");
  });

  it("lets the supervisor open only their own team (another id is not found)", () => {
    const supervisor = { ...base, role: "supervisor", audience: "supervisor" as const, viewerUserId: "sup-1" };
    expect(resolveTeamPageAccess(supervisor)).toBe("render");
    expect(resolveTeamPageAccess({ ...supervisor, requestedSupervisorId: "sup-2" })).toBe("notFound");
  });

  it("denies everyone else", () => {
    expect(resolveTeamPageAccess({ ...base, role: "broker", audience: "broker" })).toBe("denied");
  });
});
