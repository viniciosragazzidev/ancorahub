import { describe, expect, it } from "vitest";

import type { TeamAlert } from "@/features/team-management/alerts";
import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "@/features/team-management/metrics";

import { buildManagerBlock, buildTeamPageView, groupAttentionByBroker, nobodyNeedsYou, pickTeamSummary, plainHealthPoint, sortAttentionAlerts } from "./team-page";
import { resolveTeamPageAccess } from "./team-page-access";

// Quarta-feira, 15/10/2026 ao meio-dia UTC.
const NOW = new Date("2026-10-15T12:00:00.000Z");

function window(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 10, accepted: 8, acceptanceRate: 80, medianAcceptanceSeconds: 60, redistributions: 0, slaRate: 90,
    slaLeads: 0,activeLeads: 4, overdueReturns: 0, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
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

function alert(overrides: Partial<TeamAlert> & Pick<TeamAlert, "id" | "severity" | "message" | "subjectId" | "subjectType">): TeamAlert {
  return overrides as TeamAlert;
}

describe("ordenação dos alertas por severidade", () => {
  it("puts critical first, then warning, then info, keeping the G0 order inside each severity", () => {
    const alerts = [
      alert({ id: "few_leads", severity: "info", message: "a", subjectId: "1", subjectType: "broker" }),
      alert({ id: "overloaded", severity: "warning", message: "b", subjectId: "2", subjectType: "broker" }),
      alert({ id: "critical_pending", severity: "critical", message: "c", subjectId: "t", subjectType: "team" }),
      alert({ id: "conversion_falling", severity: "warning", message: "d", subjectId: "3", subjectType: "broker" }),
    ];

    expect(sortAttentionAlerts(alerts).map((item) => item.message)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("um card por corretor", () => {
  it("groups a broker's alerts into one card: the most severe phrase, the others as badges, and the critical lead", () => {
    const alerts = [
      alert({ id: "overloaded", severity: "warning", message: "Carla está com 11 leads ativos.", subjectId: "carla", subjectType: "broker" }),
      alert({ id: "many_without_next_action", severity: "warning", message: "Carla tem 4 leads sem próxima ação.", subjectId: "carla", subjectType: "broker" }),
      alert({ id: "few_leads", severity: "info", message: "Fábio está com poucos leads.", subjectId: "fabio", subjectType: "broker" }),
    ];
    const cards = groupAttentionByBroker(alerts, [broker("carla"), broker("fabio")], new Map([["carla", { leadId: "lead-9", leadName: "Mariana" }]]));

    expect(cards.map((card) => card.brokerId)).toEqual(["carla", "fabio"]);
    expect(cards[0]?.message).toBe("Carla está com 11 leads ativos.");
    expect(cards[0]?.badges.map((badge) => badge.label)).toEqual(["Sem próxima ação"]);
    expect(cards[0]?.lead).toEqual({ leadId: "lead-9", leadName: "Mariana" });
    expect(cards[1]?.lead).toBeNull();
  });
});

describe("linha de resumo da equipe", () => {
  it("shows the most severe team alert, but not the ones that only repeat a broker card", () => {
    const alerts = [
      alert({ id: "overloaded", severity: "warning", message: "1 corretor está com mais de 50% acima da média.", subjectId: "t", subjectType: "team" }),
      alert({ id: "critical_pending", severity: "critical", message: "A equipe acumula 3 retornos urgentes vencidos.", subjectId: "t", subjectType: "team" }),
    ];

    expect(pickTeamSummary(alerts)).toBe("A equipe acumula 3 retornos urgentes vencidos.");
    expect(pickTeamSummary([alerts[0]!])).toBeNull();
  });
});

describe("frases da saúde sem prefixo", () => {
  it("drops the 'Destaque:' and 'Ponto de atenção:' prefixes", () => {
    expect(plainHealthPoint("Destaque: SLA de primeiro contato em 88%.")).toBe("SLA de primeiro contato em 88%.");
    expect(plainHealthPoint("Ponto de atenção: conversão de 8% (média da unidade: 12%).")).toBe("Conversão de 8% (média da unidade: 12%).");
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
      unitConversionRate: null, now: NOW, viewer: "supervisor", goal: null,
    });

    expect(view.load.average).toBeCloseTo(5.67, 1);
    expect(view.load.brokers.map((item) => [item.id, item.overThreshold])).toEqual([["a", false], ["b", false], ["c", true]]);
  });
});

describe("estado vazio 'Ninguém precisa de você agora'", () => {
  it("is shown when the team has no alert at all", () => {
    const view = buildTeamPageView({ team: team([broker("a"), broker("b")]), unitConversionRate: null, now: NOW, viewer: "supervisor", goal: null });

    expect(view.attention).toEqual([]);
    expect(view.teamSummary).toBeNull();
    expect(nobodyNeedsYou(view)).toBe(true);
  });

  it("is not shown when a broker needs attention", () => {
    const view = buildTeamPageView({
      team: team([broker("a", { current: { leadsWithoutNextAction: 5 } }), broker("b")]),
      unitConversionRate: null, now: NOW, viewer: "supervisor", goal: null,
    });

    expect(nobodyNeedsYou(view)).toBe(false);
    expect(view.attention[0]?.brokerId).toBe("a");
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
    const input = { team: team([broker("a")]), unitConversionRate: null, now: NOW, goal: null };

    expect(buildTeamPageView({ ...input, viewer: "gestor" }).managerBlock).not.toBeNull();
    expect(buildTeamPageView({ ...input, viewer: "supervisor" }).managerBlock).toBeNull();
  });
});

describe("tendência dos números", () => {
  it("shows the trend as the favorable direction", () => {
    const view = buildTeamPageView({
      team: team([broker("a")], { current: window({ slaRate: 95 }), previous: window({ slaRate: 80 }) }),
      unitConversionRate: null, now: NOW, viewer: "supervisor", goal: null,
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
