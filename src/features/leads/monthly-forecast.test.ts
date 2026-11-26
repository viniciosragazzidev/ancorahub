import { describe, expect, it } from "vitest";

import {
  FORECAST_STAGES,
  aggregateForecastLeads,
  computeMonthlyForecast,
  defaultForecastChances,
  forecastScopeLabel,
  forecastViewer,
  formatForecastCents,
  normalizeForecastChancesInput,
  parseForecastChances,
  withoutValueLabel,
} from "./monthly-forecast";

describe("previsão do mês ponderada", () => {
  it("multiplica o valor bruto de cada etapa pela chance e soma", () => {
    const rows = aggregateForecastLeads([
      { status: "quote_sent", monthlyValue: "1000.00" },
      { status: "quote_sent", monthlyValue: 500 },
      { status: "negotiation", monthlyValue: "2000" },
      { status: "under_analysis", monthlyValue: "1000" },
    ]);
    const forecast = computeMonthlyForecast(rows);
    const quote = forecast.stages.find((stage) => stage.status === "quote_sent")!;
    expect(quote).toMatchObject({ count: 2, grossCents: 150_000, chance: 20, weightedCents: 30_000 });
    expect(forecast.stages.find((stage) => stage.status === "negotiation")).toMatchObject({ grossCents: 200_000, chance: 50, weightedCents: 100_000 });
    expect(forecast.stages.find((stage) => stage.status === "under_analysis")).toMatchObject({ chance: 85, weightedCents: 85_000 });
    expect(forecast.totalWeightedCents).toBe(215_000);
    expect(forecast.totalGrossCents).toBe(450_000);
    expect(forecast.counted).toBe(4);
    expect(forecast.withoutValue).toBe(0);
  });

  it("deixa de fora e conta os leads sem valor", () => {
    const rows = aggregateForecastLeads([
      { status: "documentation_pending", monthlyValue: null },
      { status: "documentation_pending", monthlyValue: "0" },
      { status: "documentation_pending", monthlyValue: "abc" },
      { status: "documentation_pending", monthlyValue: "300" },
    ]);
    const forecast = computeMonthlyForecast(rows);
    expect(forecast.withoutValue).toBe(3);
    expect(forecast.counted).toBe(1);
    expect(forecast.totalWeightedCents).toBe(21_000);
    expect(withoutValueLabel(forecast.withoutValue)).toBe("3 leads sem valor ficaram de fora.");
    expect(withoutValueLabel(1)).toBe("1 lead sem valor ficou de fora.");
    expect(withoutValueLabel(0)).toBeNull();
  });

  it("ignora etapas fora do funil aberto e usa as chances ajustadas", () => {
    const rows = aggregateForecastLeads([
      { status: "converted", monthlyValue: "9999" },
      { status: "lost", monthlyValue: "9999" },
      { status: "new", monthlyValue: "9999" },
      { status: "negotiation", monthlyValue: "1000" },
    ]);
    const forecast = computeMonthlyForecast(rows, { ...defaultForecastChances(), negotiation: 10 });
    expect(forecast.totalWeightedCents).toBe(10_000);
    expect(forecast.stages.map((stage) => stage.status)).toEqual(FORECAST_STAGES.map((stage) => stage.status));
  });

  it("soma em centavos sem erro de ponto flutuante", () => {
    const rows = aggregateForecastLeads(Array.from({ length: 10 }, () => ({ status: "quote_sent", monthlyValue: "0.10" })));
    expect(computeMonthlyForecast(rows).stages.find((stage) => stage.status === "quote_sent")!.grossCents).toBe(100);
  });

  it("formata em reais sem centavos", () => {
    expect(formatForecastCents(215_000).replace(/\s/g, " ")).toBe("R$ 2.150");
  });
});

describe("chances por etapa", () => {
  it("usa as padrão quando não há nada guardado ou o JSON é inválido", () => {
    expect(parseForecastChances(undefined)).toEqual(defaultForecastChances());
    expect(parseForecastChances("{oops")).toEqual(defaultForecastChances());
  });

  it("aceita só inteiros de 0 a 100 e completa o resto com o padrão", () => {
    const chances = parseForecastChances(JSON.stringify({ quote_sent: 35, negotiation: 150, under_analysis: "90" }));
    expect(chances.quote_sent).toBe(35);
    expect(chances.negotiation).toBe(50);
    expect(chances.under_analysis).toBe(90);
  });

  it("recusa salvar etapa sem chance válida, com a causa", () => {
    const valid = Object.fromEntries(FORECAST_STAGES.map((stage) => [stage.status, String(stage.defaultChance)]));
    expect(normalizeForecastChancesInput(valid)).toEqual({ ok: true, chances: defaultForecastChances() });
    const result = normalizeForecastChancesInput({ ...valid, negotiation: "101" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Negociação");
    expect(normalizeForecastChancesInput({ ...valid, quote_sent: "2.5" }).ok).toBe(false);
  });
});

describe("rótulo do escopo", () => {
  it("diz de quem são os leads da previsão", () => {
    expect(forecastScopeLabel("director")).toBe("Leads abertos da empresa");
    expect(forecastScopeLabel("manager")).toBe("Leads abertos da unidade");
    expect(forecastScopeLabel("supervisor")).toBe("Leads abertos da equipe");
    expect(forecastScopeLabel("broker")).toBe("Seus leads abertos");
  });
});

describe("quem vê a previsão", () => {
  it("supervisor vê a equipe sem Configurações; só o diretor ajusta", () => {
    expect(forecastViewer("supervisor")).toEqual({ scopeLabel: "Leads abertos da equipe", canConfigure: false });
    expect(forecastViewer("manager").canConfigure).toBe(false);
    expect(forecastViewer("director")).toEqual({ scopeLabel: "Leads abertos da empresa", canConfigure: true });
  });
});
