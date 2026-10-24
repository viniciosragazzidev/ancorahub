import { describe, expect, it } from "vitest";

import { funnelPeriodForOverview, funnelPeriodStart, parseFunnelPeriod } from "./funnel";

describe("períodos do funil", () => {
  it.each([
    ["today", "today"],
    ["7d", 7],
    ["30d", 30],
  ] as const)("mapeia o período do painel %s", (overviewPeriod, expected) => {
    expect(funnelPeriodForOverview(overviewPeriod)).toBe(expected);
  });

  it("usa o início do dia operacional às 19h de São Paulo para Hoje", () => {
    const now = new Date("2026-10-24T18:00:00.000Z");
    expect(funnelPeriodStart("today", now).toISOString()).toBe("2026-10-23T22:00:00.000Z");
  });

  it("preserva a janela numérica e o parser antigo do painel sem Lite", () => {
    const now = new Date("2026-10-24T18:00:00.000Z");
    expect(funnelPeriodStart(7, now).toISOString()).toBe("2026-10-17T18:00:00.000Z");
    expect(parseFunnelPeriod("30")).toBe(30);
    expect(parseFunnelPeriod("hoje")).toBe(7);
  });
});
