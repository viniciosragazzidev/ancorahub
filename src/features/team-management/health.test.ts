import { describe, expect, it } from "vitest";

import { TEAM_HEALTH_WEIGHTS, teamHealthScore, type TeamHealthInput } from "./health";

const healthy: TeamHealthInput = {
  slaRate: 95,
  acceptanceRate: 90,
  overdueReturns: 1,
  leadsWithoutNextAction: 1,
  activeLeads: 40,
  conversionRate: 20,
  unitAverageConversionRate: 18,
  redistributions: 1,
  offersReceived: 20,
  activeBrokers: 4,
  brokersActiveWithinTwoBusinessDays: 4,
  brokerActiveLeads: [9, 10, 10, 11],
};

describe("teamHealthScore", () => {
  it("uses the approved weights and returns a score in the excellent band", () => {
    expect(Object.values(TEAM_HEALTH_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);
    const result = teamHealthScore(healthy);
    expect(result).toMatchObject({ band: "Excelente", score: expect.any(Number) });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.strongPoints).toHaveLength(2);
    expect(result.attentionPoints).toHaveLength(2);
    expect(result.strongPoints.every((point) => point.startsWith("Destaque: "))).toBe(true);
    expect(result.attentionPoints.every((point) => point.startsWith("Ponto de atenção: "))).toBe(true);
  });

  it("clamps weak components and has a critical band", () => {
    const result = teamHealthScore({
      ...healthy,
      slaRate: 0,
      acceptanceRate: 0,
      overdueReturns: 20,
      leadsWithoutNextAction: 20,
      activeLeads: 1,
      conversionRate: 0,
      unitAverageConversionRate: 10,
      redistributions: 20,
      offersReceived: 20,
      brokersActiveWithinTwoBusinessDays: 0,
      brokerActiveLeads: [100, 0],
    });
    expect(result.band).toBe("Crítico");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThan(50);
    expect(Object.values(result.components).every((score) => score >= 0 && score <= 100)).toBe(true);
  });

  it("avoids NaN with empty denominators", () => {
    const result = teamHealthScore({
      ...healthy,
      activeLeads: 0,
      offersReceived: 0,
      activeBrokers: 0,
      brokerActiveLeads: [],
      unitAverageConversionRate: 0,
      conversionRate: 0,
    });
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.components.conversion).toBe(50);
    expect(result.components.redistributions).toBe(50);
  });
});
