// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/desempenho",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { buildBrokerPerformanceView, type BrokerPerformanceData, type BrokerPerformanceTotals } from "../domain";
import { BrokerPerformanceLite } from "./broker-performance-lite";

afterEach(cleanup);

const totals = (overrides: Partial<BrokerPerformanceTotals> = {}): BrokerPerformanceTotals => ({
  leads: 0, quotes: 0, sales: 0, revenue: 0, slaRate: 0, slaLeads: 0, ...overrides,
});

const view = (overrides: Partial<BrokerPerformanceData> = {}) => buildBrokerPerformanceView({
  period: "7d",
  today: "2026-11-13",
  current: totals({ leads: 20, quotes: 10, sales: 3, revenue: 4500, slaLeads: 18, slaRate: 88.9 }),
  previous: totals({ leads: 16, quotes: 10, sales: 3, revenue: 5000 }),
  series: [],
  carriers: [{ name: "Operadora Exemplo", sales: 2, revenue: 3000 }],
  goal: { name: "Meta de novembro", targetType: "sales_count", targetValue: 12, current: 3, percentage: 25, endDay: "2026-11-30" },
  ...overrides,
});

const blocks = (container: HTMLElement) => [...container.querySelectorAll("[data-block]")].map((node) => node.getAttribute("data-block"));

describe("BrokerPerformanceLite, composição por resultados (chave ligada)", () => {
  it("segue a ordem período, resultados, indicadores, metas e Minha jornada", () => {
    const { container } = render(
      <BrokerPerformanceLite view={view()} composition="results" journey={<section aria-label="Minha jornada">cartão</section>} />,
    );
    expect(blocks(container)).toEqual(["periodo", "resultados", "indicadores", "metas", "jornada"]);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(["Resultados dos últimos 7 dias", "Atendimento e conversão", "Metas", "Meta de novembro"]);
    const period = screen.getByRole("group", { name: "Período" });
    expect(container.querySelector('[data-block="periodo"]')?.contains(period)).toBe(true);
  });

  it("mostra os indicadores existentes com período e sem ranking ou placar", () => {
    render(<BrokerPerformanceLite view={view()} composition="results" />);
    const service = screen.getByRole("region", { name: "Atendimento e conversão" });
    expect(within(service).getByText("Primeiro contato no prazo")).toBeTruthy();
    expect(within(service).getByText("18 leads medidos nos últimos 7 dias")).toBeTruthy();
    expect(within(service).getByText("Leads que viraram cotação")).toBeTruthy();
    expect(within(service).getByText("Cotações que viraram venda")).toBeTruthy();
    expect(screen.queryByText(/ranking|placar|missões/i)).toBeNull();
  });

  it("não transforma ausência de dado em zero e esconde o que está vazio (refino 14/11/2026)", () => {
    const { container } = render(
      <BrokerPerformanceLite view={view({ current: totals(), previous: totals(), carriers: [], goal: null, period: "hoje" })} composition="results" />,
    );
    expect(screen.getAllByText("Sem dado")).toHaveLength(3);
    expect(screen.getByText("Nenhum lead com prazo medido hoje")).toBeTruthy();
    // Sem meta ativa e sem venda por operadora, os blocos saem da tela em vez de mostrar um aviso de vazio.
    expect(screen.queryByText(/Nenhuma meta ativa para você agora/)).toBeNull();
    expect(screen.queryByText("Nenhuma venda neste período.")).toBeNull();
    expect(blocks(container)).toEqual(["periodo", "resultados", "indicadores"]);
    // O banner do capitão leva aos leads.
    expect(screen.getByRole("region", { name: "Dica do desempenho" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver meus leads" }).getAttribute("href")).toBe("/minha-fila");
  });
});

describe("BrokerPerformanceLite, composição clássica (chave desligada)", () => {
  it("mantém os blocos de antes, sem os novos indicadores nem a jornada", () => {
    const { container } = render(<BrokerPerformanceLite view={view()} />);
    expect(blocks(container)).toEqual([]);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual(["Seus números", "Meta de novembro", "Seu funil", "Vendas por operadora"]);
    expect(screen.queryByText("Atendimento e conversão")).toBeNull();
    expect(screen.queryByText("Primeiro contato no prazo")).toBeNull();
  });
});
