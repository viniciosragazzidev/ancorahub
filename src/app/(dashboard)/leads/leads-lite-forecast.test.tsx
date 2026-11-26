// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { aggregateForecastLeads, computeMonthlyForecast, defaultForecastChances } from "@/features/leads/monthly-forecast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/leads/monthly-forecast-actions", () => ({ saveForecastChancesAction: vi.fn(async () => ({ ok: true })) }));

import { LeadsLiteForecast, type LeadsLiteForecastData } from "./leads-lite-forecast";

afterEach(cleanup);

function data(canConfigure: boolean): LeadsLiteForecastData {
  const forecast = computeMonthlyForecast(aggregateForecastLeads([
    { status: "negotiation", monthlyValue: "2000" },
    { status: "quote_sent", monthlyValue: null },
  ]));
  return { ...forecast, chances: defaultForecastChances(), scopeLabel: "Leads abertos da empresa", canConfigure };
}

describe("LeadsLiteForecast", () => {
  it("mostra o número discreto, quantos ficaram sem valor e abre a conta por etapa", () => {
    render(<LeadsLiteForecast forecast={data(false)} />);
    const trigger = screen.getByRole("button", { name: /Previsão do mês/ });
    expect(trigger.textContent?.replace(/\s/g, " ")).toContain("R$ 1.000");
    expect(screen.getByText("1 lead sem valor ficou de fora.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Configurações/ })).toBeNull();
    fireEvent.click(trigger);
    const row = screen.getByRole("rowheader", { name: "Negociação" }).closest("tr")!;
    expect(row.textContent?.replace(/\s/g, " ")).toContain("50%");
  });

  it("só o diretor vê Configurações com as chances por etapa", () => {
    render(<LeadsLiteForecast forecast={data(true)} />);
    fireEvent.click(screen.getByRole("button", { name: /Configurações/ }));
    expect((screen.getByLabelText(/Em análise na operadora/) as HTMLInputElement).value).toBe("85");
    expect(screen.getByRole("button", { name: /Salvar chances/ })).toBeTruthy();
  });
});
