// @vitest-environment jsdom
/** Bordas do painel Lite (print de produção de 25/10): uma hora de dado, dia zerado, número que não dá para calcular. */
import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (media: string) => ({
  matches: false, media, onchange: null,
  addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
}));
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
// O setup global troca motion/react por um proxy sem useInView; aqui as colunas do gráfico precisam do real.
vi.mock("motion/react", async (importOriginal) => importOriginal<typeof import("motion/react")>());

import { CASE_NOW, essentialCase, funnelCase, qualityCase } from "@/app/dev/diretor-shell-real/dashboard-cases";

import { EssentialView } from "./essential-view";
import { noDataLabel, noLeadsSince, periodWords } from "./format";
import { hourAxis, tickEvery } from "./hour-axis";
import { QualificationFunnelView, repliedDetail } from "./qualification-funnel-view";
import { QualityView } from "./quality-view";

afterEach(cleanup);

const FORBIDDEN = new RegExp(`sem dados para sem dados|${String.fromCharCode(0x2014)}`, "i");

describe("rótulos de borda", () => {
  it("número sem cálculo vira um texto curto pelo período", () => {
    expect(noDataLabel("today")).toBe("Sem dados hoje");
    expect(noDataLabel(7)).toBe("Sem dados no período");
    expect(periodWords("today")).toBe("hoje");
    expect(periodWords(30)).toBe("no período");
  });

  it("resposta sem mediana nem respostas não vira \"resposta em sem respostas ainda\"", () => {
    expect(repliedDetail(0, null)).toBe("Ninguém respondeu ainda");
    expect(repliedDetail(3, null)).toBe("3 leads");
    expect(repliedDetail(3, 6)).toBe("3 leads, resposta em 6 min (mediana)");
  });
});

describe("eixo do gráfico hora a hora", () => {
  it("hoje com uma ou duas horas de dado: o dia inteiro das 19h, horas vazias só na linha de base", () => {
    const axis = hourAxis(qualityCase("uma-hora"), CASE_NOW["uma-hora"]);
    expect(axis).toHaveLength(24);
    expect(axis[0].label).toBe("19h");
    expect(axis[23].label).toBe("18h");
    expect(axis.filter((hour) => !hour.empty).map((hour) => hour.label)).toEqual(["19h", "20h"]);
    // Depois das 20h42 as horas ainda não começaram.
    expect(axis.findIndex((hour) => hour.future)).toBe(2);
  });

  it("uma hora só com dado nunca ocupa o card: 1 de 24 colunas, de no máximo 10px por barra", () => {
    const report = qualityCase("uma-hora");
    const single = { ...report, hours: report.hours.slice(-1) };
    const axis = hourAxis(single, CASE_NOW["uma-hora"]);
    expect(axis).toHaveLength(24);
    expect(axis.filter((hour) => !hour.empty)).toHaveLength(1);
    const css = readFileSync(path.join(__dirname, "director-lite.module.css"), "utf8");
    expect(css).toMatch(/\.column \{[^}]*flex: 0 1 10px;/);
    expect(css).toMatch(/\.hourSlot \{[^}]*flex: 1 1 0;/);
  });

  it("período longo: as 24 horas do dia médio, mesmo com horas sem lead", () => {
    const report = { ...qualityCase("uma-fila"), period: 7 as const, hourly: "hour_of_day" as const, hours: [] };
    const axis = hourAxis(report);
    expect(axis).toHaveLength(24);
    expect(axis.every((hour) => hour.empty && !hour.future)).toBe(true);
  });

  it("rótulos não se sobrepõem no celular", () => {
    expect(tickEvery(2)).toBe(1);
    expect(tickEvery(12)).toBe(2);
    expect(tickEvery(24)).toBe(3);
  });
});

describe("Qualidade nas bordas", () => {
  it("hoje com uma hora: explica a distribuição zerada e não imprime zeros soltos", () => {
    const { container } = render(<QualityView report={qualityCase("uma-hora")} unitName={null} now={CASE_NOW["uma-hora"]} />);
    expect(container.textContent).not.toMatch(FORBIDDEN);
    expect(screen.getByText(/Nenhum lead foi para os corretores hoje/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver plantões/ })).toHaveAttribute("href", "/leads/distribuicao?view=plantao");
    expect(screen.queryByText(/0 leads a menos/)).not.toBeInTheDocument();
    expect(screen.getByText(/Vendas vindas de leads frios hoje: 0/)).toBeInTheDocument();
    const chart = screen.getByRole("img", { name: /Leads bons e frios que entraram por hora/ });
    expect(chart.children).toHaveLength(24);
    // Só as horas com lead desenham barra (19h: 1 bom e 1 frio; 20h: 2 bons e 2 frios).
    expect(chart.querySelectorAll("[data-tone]")).toHaveLength(4);
  });

  it("média por corretor sem corretor: \"Sem dados hoje\" no tamanho do corpo, nunca \"sem dados para sem dados\"", () => {
    const report = qualityCase("uma-fila");
    const noBrokers = { ...report, distributed: { ...report.distributed, total: 5 }, withoutWeak: { ...report.withoutWeak, perBrokerNow: null, perBrokerWithout: null } };
    const { container } = render(<QualityView report={noBrokers} unitName={null} now={CASE_NOW["uma-fila"]} />);
    expect(container.textContent).not.toMatch(FORBIDDEN);
    expect(screen.getByText("Sem dados hoje")).toBeInTheDocument();
  });

  it("dia zerado: uma linha que explica e o próximo passo", () => {
    render(<QualityView report={qualityCase("zerado")} unitName={null} now={CASE_NOW.zerado} widerHref="/dashboard?tab=quality&periodo=7" />);
    expect(screen.getByText("Nenhum lead entrou hoje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver os últimos 7 dias" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=7");
    expect(screen.getByText(/Nenhum lead desde as 19h de ontem/)).toBeInTheDocument();
  });

  it("estado vazio nomeia a janela real: na segunda, desde as 19h de sexta-feira", () => {
    const monday = new Date("2026-10-26T15:00:00.000Z");
    expect(noLeadsSince("2026-10-23T22:00:00.000Z", monday)).toBe("Nenhum lead desde as 19h de sexta-feira.");
    expect(noLeadsSince("2026-10-25T22:00:00.000Z", monday)).toBe("Nenhum lead desde as 19h de ontem.");
    expect(noLeadsSince(null, null)).toBe("Nenhum lead desde as 19h de ontem.");
  });

  it("dia cheio: números grandes no formato pt-BR", () => {
    const report = qualityCase("cheio");
    expect(report.arrived.total).toBe(12_345);
    render(<QualityView report={report} unitName={null} now={CASE_NOW.cheio} />);
    expect(screen.getAllByText("12.345").length).toBeGreaterThan(0);
  }, 60_000);
});

describe("Funil e Operação nas bordas", () => {
  it("funil zerado: um estado vazio só, com o próximo passo", () => {
    const { container } = render(<QualificationFunnelView data={funnelCase("zerado")} unitName={null} widerHref="/dashboard?tab=funnel&periodo=7" />);
    expect(screen.getByText("Nenhum lead chegou hoje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver os últimos 7 dias" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/0%/);
  });

  it("funil com uma hora: zero de vendas vira frase, não \"0% dos leads\"", () => {
    const { container } = render(<QualificationFunnelView data={funnelCase("uma-hora")} unitName={null} />);
    expect(screen.getByText("Nenhuma venda hoje")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(FORBIDDEN);
  });

  it("operação zerada: sem \"0 de 0 corretores\" e sem números zerados soltos", () => {
    const { container } = render(<EssentialView data={essentialCase("zerado")} />);
    expect(container.textContent).not.toMatch(/0 de 0/);
    expect(screen.getByText(/Nenhum corretor ativo para mostrar/)).toBeInTheDocument();
    expect(screen.getByText(/Quando um lead entrar/)).toBeInTheDocument();
  });

  it("uma fila só e nenhum corretor: a tabela tem uma linha de fila mais o total", () => {
    render(<EssentialView data={essentialCase("uma-fila")} />);
    expect(screen.getAllByText("Fila Tatiana").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nenhum corretor ativo para mostrar/)).toBeInTheDocument();
  });
});
