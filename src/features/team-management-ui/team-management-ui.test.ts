import { describe, expect, it } from "vitest";

import { resolveGestaoAccess } from "./access";
import { buildUnitOverview, type TeamMetricsInput } from "./build-overview";
import { countTeamsNeedingAttention, exceptionPhrase, sortSupervisorsForComparison, sortTeamsByHealth } from "./health-order";
import type { TeamHealthCard } from "./types";

function team(overrides: Partial<TeamHealthCard> & { teamName: string }): TeamHealthCard {
  return { supervisorId: overrides.teamName, supervisorName: "Sup", image: null, brokers: 3, score: null, band: null, strengths: [], concerns: [], ...overrides };
}

describe("ordenação por faixa da saúde das equipes", () => {
  it("orders Crítico, Atenção, Saudável, Excelente and leaves teams without a band last", () => {
    const sorted = sortTeamsByHealth([
      team({ teamName: "Sem métrica", band: null }),
      team({ teamName: "Saudável", band: "saudavel", score: 75 }),
      team({ teamName: "Excelente", band: "excelente", score: 90 }),
      team({ teamName: "Crítica", band: "critico", score: 40 }),
      team({ teamName: "Atenção", band: "atencao", score: 60 }),
    ]);

    expect(sorted.map((item) => item.teamName)).toEqual(["Crítica", "Atenção", "Saudável", "Excelente", "Sem métrica"]);
  });

  it("keeps the teams of the same band in name order", () => {
    const sorted = sortTeamsByHealth([team({ teamName: "Zeta", band: "critico" }), team({ teamName: "Alfa", band: "critico" })]);

    expect(sorted.map((item) => item.teamName)).toEqual(["Alfa", "Zeta"]);
  });

  it("counts only Crítico and Atenção as needing attention", () => {
    expect(countTeamsNeedingAttention([
      team({ teamName: "a", band: "critico" }),
      team({ teamName: "b", band: "atencao" }),
      team({ teamName: "c", band: "saudavel" }),
      team({ teamName: "d", band: null }),
    ])).toBe(2);
  });
});

describe("frase de exceção", () => {
  it("never says the teams are in order without metrics", () => {
    expect(exceptionPhrase(0, false)).toBe("Indicadores de saúde chegam em breve.");
  });

  it("speaks in the singular and plural when metrics exist", () => {
    expect(exceptionPhrase(0, true)).toBe("Todas as equipes em dia");
    expect(exceptionPhrase(1, true)).toBe("1 equipe precisa de atenção");
    expect(exceptionPhrase(2, true)).toBe("2 equipes precisam de atenção");
  });
});

describe("comparação entre supervisores", () => {
  it("puts the highest score first, the ones without score last, and no podium", () => {
    const sorted = sortSupervisorsForComparison([
      { name: "Carla", score: null },
      { name: "Bruno", score: 61 },
      { name: "Ana", score: 88 },
    ]);

    expect(sorted.map((row) => row.name)).toEqual(["Ana", "Bruno", "Carla"]);
  });
});

describe("acesso à rota /gestao", () => {
  it("is not found while the flag is off, whoever asks", () => {
    expect(resolveGestaoAccess({ flagOn: false, role: "manager", audience: "manager" })).toBe("off");
  });

  it("renders for the Lite manager, redirects the Lite supervisor and denies the rest", () => {
    expect(resolveGestaoAccess({ flagOn: true, role: "manager", audience: "manager" })).toBe("render");
    expect(resolveGestaoAccess({ flagOn: true, role: "supervisor", audience: "supervisor" })).toBe("supervisor");
    expect(resolveGestaoAccess({ flagOn: true, role: "broker", audience: "broker" })).toBe("denied");
    expect(resolveGestaoAccess({ flagOn: true, role: "manager", audience: null })).toBe("denied");
  });
});

describe("montagem da visão da unidade", () => {
  const identity = {
    activeBrokers: 12,
    supervisors: [
      { supervisorId: "s1", name: "Ana", image: null, teamName: "Equipe Centro", brokers: 5 },
      { supervisorId: "s2", name: "Bruno", image: null, teamName: null, brokers: 4 },
    ],
    unassigned: [{ userId: "b9", name: "Diego" }],
  };

  it("without metrics shows structure only: no score, no band, no 'em dia' phrase", () => {
    const overview = buildUnitOverview({ ...identity, metrics: null });

    expect(overview.metricsAvailable).toBe(false);
    expect(overview.teams.every((card) => card.score === null && card.band === null)).toBe(true);
    expect(overview.teamsNeedingAttention).toBe(0);
    expect(overview.kpis.find((kpi) => kpi.key === "brokers")?.value).toBe("12");
    expect(overview.kpis.find((kpi) => kpi.key === "sla")?.value).toBeNull();
    expect(overview.teams[1]?.teamName).toBe("Equipe de Bruno");
    expect(overview.unassigned).toEqual({ brokers: 1, names: ["Diego"] });
  });

  it("with metrics fills the score, band and the notes per team and counts the attention", () => {
    const metrics = new Map<string, TeamMetricsInput>([
      ["s1", { score: 40, band: "critico", sla: "30 min", acceptRate: "50%", conversion: "8%", trend: "down", strengths: ["a"], concerns: ["x", "y", "z"] }],
      ["s2", { score: 90, band: "excelente", sla: "5 min", acceptRate: "95%", conversion: "30%", trend: "up", strengths: [], concerns: [] }],
    ]);
    const overview = buildUnitOverview({ ...identity, metrics });

    expect(overview.metricsAvailable).toBe(true);
    expect(overview.teamsNeedingAttention).toBe(1);
    expect(overview.teams.find((card) => card.supervisorId === "s1")?.concerns).toEqual(["x", "y", "z"]);
    expect(overview.supervisors.find((row) => row.supervisorId === "s2")?.trend).toBe("up");
  });
});
