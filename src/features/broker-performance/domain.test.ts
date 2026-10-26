import { describe, expect, it } from "vitest";

import {
  buildBrokerPerformanceView,
  buildGoalView,
  businessDaysLeft,
  metricChange,
  parseBrokerPerformancePeriod,
  pickInsight,
  type BrokerPerformanceData,
  type BrokerPerformanceTotals,
} from "./domain";

const totals = (overrides: Partial<BrokerPerformanceTotals> = {}): BrokerPerformanceTotals => ({
  leads: 0, quotes: 0, sales: 0, revenue: 0, slaRate: 100, slaLeads: 0, ...overrides,
});

const data = (overrides: Partial<BrokerPerformanceData> = {}): BrokerPerformanceData => ({
  period: "7d",
  today: "2026-10-26",
  current: totals({ leads: 20, quotes: 10, sales: 3, revenue: 4500, slaLeads: 20, slaRate: 90 }),
  previous: totals({ leads: 16, quotes: 10, sales: 3, revenue: 5000 }),
  series: [],
  carriers: [],
  goal: null,
  ...overrides,
});

describe("broker performance period", () => {
  it("defaults to 7 days and accepts only known periods", () => {
    expect(parseBrokerPerformancePeriod(undefined)).toBe("7d");
    expect(parseBrokerPerformancePeriod("hoje")).toBe("hoje");
    expect(parseBrokerPerformancePeriod(["30d"])).toBe("30d");
    expect(parseBrokerPerformancePeriod("90d")).toBe("7d");
  });
});

describe("metric change", () => {
  it("compares with the previous window without inventing a percent from zero", () => {
    expect(metricChange(0, 0)).toBeNull();
    expect(metricChange(3, 0)).toEqual({ kind: "new", direction: "up" });
    expect(metricChange(10, 10)).toEqual({ kind: "flat" });
    expect(metricChange(12, 10)).toEqual({ kind: "percent", value: 0.2, direction: "up" });
    expect(metricChange(9, 12)).toMatchObject({ kind: "percent", direction: "down" });
  });
});

describe("goal pace", () => {
  it("counts business days in São Paulo, both ends included", () => {
    expect(businessDaysLeft("2026-10-26", "2026-10-31")).toBe(5); // seg a sex; sábado fora
    expect(businessDaysLeft("2026-10-31", "2026-10-31")).toBe(0);
    expect(businessDaysLeft("2026-11-01", "2026-10-31")).toBe(0);
  });

  it("says how much is left per business day for count and currency goals", () => {
    const sales = buildGoalView({ name: "Meta de outubro", targetType: "sales_count", targetValue: 12, current: 10, percentage: 83.3, endDay: "2026-10-31" }, "2026-10-26");
    expect(sales).toMatchObject({ percentage: 83, currentLabel: "10", targetLabel: "12" });
    expect(sales.pace).toBe("Faltam 2 vendas em 5 dias úteis, cerca de 0,4 por dia.");
    const revenue = buildGoalView({ name: "Receita", targetType: "revenue", targetValue: 10000, current: 8000, percentage: 80, endDay: "2026-10-31" }, "2026-10-26");
    expect(revenue.pace).toMatch(/^Faltam R\$\s2\.000 em 5 dias úteis, cerca de R\$\s400 por dia\.$/);
  });

  it("celebrates a reached goal and skips pace for rate goals", () => {
    expect(buildGoalView({ name: "Meta", targetType: "sales_count", targetValue: 5, current: 6, percentage: 120, endDay: "2026-10-31" }, "2026-10-26"))
      .toMatchObject({ percentage: 100, pace: "Meta batida. O que vier agora é extra." });
    expect(buildGoalView({ name: "SLA", targetType: "sla_rate", targetValue: 90, current: 80, percentage: 88, endDay: "2026-10-31" }, "2026-10-26").pace).toBeNull();
  });
});

describe("insight", () => {
  it("puts a late first contact first", () => {
    expect(pickInsight(data({ current: totals({ leads: 10, slaLeads: 10, slaRate: 60, sales: 5 }), previous: totals({ sales: 1 }) })))
      .toContain("60% dos seus leads");
  });

  it("celebrates more sales than the previous window", () => {
    expect(pickInsight(data({ current: totals({ leads: 10, quotes: 5, sales: 4 }), previous: totals({ sales: 2 }) })))
      .toBe("Você fez 2 vendas a mais que no período anterior.");
  });

  it("points at quotes that are not closing", () => {
    expect(pickInsight(data({ current: totals({ leads: 10, quotes: 10, sales: 2 }), previous: totals({ sales: 2 }) })))
      .toBe("20% das suas cotações viraram venda. Retomar as cotações abertas é o próximo passo.");
  });

  it("names the best weekday only when it is not tied", () => {
    const series = [
      { key: "2026-10-21", weekday: 3, leads: 2, quotes: 1, sales: 2, revenue: 0 },
      { key: "2026-10-22", weekday: 4, leads: 2, quotes: 1, sales: 1, revenue: 0 },
    ];
    const quiet = { current: totals({ leads: 4, quotes: 2, sales: 3 }), previous: totals({ sales: 3 }) };
    expect(pickInsight(data({ ...quiet, series }))).toBe("Seu melhor dia foi quarta, com 2 vendas.");
    expect(pickInsight(data({ ...quiet, series: series.map((point) => ({ ...point, sales: 1 })) }))).toBeNull();
    expect(pickInsight(data({ ...quiet, series, period: "hoje" }))).toBeNull();
  });
});

describe("broker performance view", () => {
  it("builds the four cards, the funnel and the carriers from the broker's own totals", () => {
    const view = buildBrokerPerformanceView(data({ carriers: [{ name: "Amil", sales: 2, revenue: 3000 }] }));
    expect(view.cards.map((card) => [card.key, card.value])).toEqual([["leads", 20], ["quotes", 10], ["sales", 3], ["revenue", 4500]]);
    expect(view.cards[0]).toMatchObject({ change: { kind: "percent", direction: "up" }, comparisonLabel: "vs 7 dias antes" });
    expect(view.funnel.stages.map((stage) => stage.widthPercent)).toEqual([100, 50, 15]);
    expect(view.funnel.note).toBe("Onde mais perde: da cotação para a venda (30% viram venda).");
    expect(view.carriers[0].revenueLabel).toMatch(/R\$\s3\.000/);
  });

  it("shows an empty state with no insight when nothing moved", () => {
    const view = buildBrokerPerformanceView(data({ period: "hoje", current: totals(), previous: totals() }));
    expect(view.empty).toBe(true);
    expect(view.insight).toBeNull();
    expect(view.funnel.note).toBeNull();
    expect(view.summary).toBe("Nenhum movimento hoje ainda. Seus números aparecem aqui ao longo do dia.");
  });

  it("sums up sales and revenue in the header and keeps the goal pace in the ring only", () => {
    const view = buildBrokerPerformanceView(data({ goal: { name: "Meta de outubro", targetType: "sales_count", targetValue: 12, current: 10, percentage: 83, endDay: "2026-10-31" } }));
    expect(view.summary).toMatch(/^3 vendas e R\$\s4\.500 nos últimos 7 dias\.$/);
    expect(view.goal?.pace).toBe("Faltam 2 vendas em 5 dias úteis, cerca de 0,4 por dia.");
    expect(buildBrokerPerformanceView(data({ period: "hoje" })).summary).toMatch(/hoje\.$/);
  });
});
