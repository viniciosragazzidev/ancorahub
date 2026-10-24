// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

// Fixtures tipadas: o construtor de exemplo da prévia devolve o relatório simples no mesmo tipo do servidor.
import { buildSimpleQuality } from "@/app/dev/diretor-dashboard-preview/_components/data";
import type { SimpleLeadQualityReportData } from "@/features/reports/metrics/lead-quality-service";
import { displacementOf, readMotion } from "@/components/lite/motion/capture-motion";

import { DirectorLiteChrome, dashboardHref } from "./director-lite-chrome";
import { QualityDisabled, QualityToolbar, QualityView } from "./quality-view";

// jsdom não tem IntersectionObserver: as colunas do gráfico (useInView) só precisam que o observador exista.
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

const NOW = new Date("2026-10-24T16:42:00.000Z");
const BRANCHES = [{ id: "branch-centro", name: "Centro" }, { id: "branch-barra", name: "Barra da Tijuca" }];

afterEach(() => {
  cleanup();
  motionState.reduce = false;
});

function emptyReport(): SimpleLeadQualityReportData {
  return { ...buildSimpleQuality(7, "all", null, NOW), arrived: { total: 0, good: 0, cold: 0, noReply: 0, other: 0 } };
}

describe("Qualidade dos leads, vista Simples (dados reais)", () => {
  it("mostra as quatro perguntas, com o total que entrou e a parte de bons", () => {
    const report = buildSimpleQuality(7, "all", null, NOW);
    render(<QualityView report={report} unitName={null} />);
    // O número do passo entra no nome do título: a busca é pelo trecho.
    expect(screen.getByRole("heading", { name: /Quantos leads entraram e quantos são bons/ })).toBeInTheDocument();
    expect(screen.getByText("Bons (quentes e mornos)")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /E se não mandasse os frios/ })).toBeInTheDocument();
    expect(screen.getByText("Todas as unidades", { exact: false })).toBeInTheDocument();
  });

  it("nomeia a unidade escolhida no card de entradas", () => {
    render(<QualityView report={buildSimpleQuality(7, "all", null, NOW)} unitName="Centro" />);
    expect(screen.getByText("Unidade Centro")).toBeInTheDocument();
  });

  it("tem uma linha por fila de entrada, mais o cabeçalho", () => {
    const report = buildSimpleQuality(7, "all", null, NOW);
    render(<QualityView report={report} unitName={null} />);
    const [queues] = screen.getAllByRole("table");
    expect(within(queues!).getAllByRole("row")).toHaveLength(report.byQueue.length + 1);
  });

  it("a tabela hora a hora abre e fecha pelo botão", () => {
    render(<QualityView report={buildSimpleQuality(7, "all", null, NOW)} unitName={null} />);
    const toggle = screen.getByRole("button", { name: "Ver hora a hora em tabela" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Esconder a tabela" })).toHaveAttribute("aria-expanded", "true");
  });

  it("sem lead no período, mostra o estado vazio no lugar das perguntas", () => {
    render(<QualityView report={emptyReport()} unitName={null} />);
    expect(screen.getByText("Nenhum lead neste período")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Por fila/ })).not.toBeInTheDocument();
  });

  it("central desligada: mostra o estado Lite com a volta ao painel", () => {
    render(<QualityDisabled />);
    expect(screen.getByText("Central temporariamente indisponível")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/dashboard");
  });

  it("com movimento reduzido, nenhum bloco entra deslocado", () => {
    motionState.reduce = true;
    const { container } = render(<QualityView report={buildSimpleQuality(7, "all", null, NOW)} unitName={null} />);
    const animated = Array.from(container.querySelectorAll("[data-initial]"));
    expect(animated.length).toBeGreaterThan(0);
    for (const element of animated) {
      expect(displacementOf(readMotion(element).initial)).toEqual([]);
    }
  });
});

describe("filtros do topo na aba Qualidade", () => {
  it("a aba Qualidade leva período e unidade junto", () => {
    expect(dashboardHref("quality", "30", "branch-centro")).toBe("/dashboard?tab=quality&periodo=30&unidade=branch-centro");
    expect(dashboardHref("quality", "hoje", null)).toBe("/dashboard?tab=quality&periodo=hoje");
    expect(dashboardHref("overview", "7", null)).toBe("/dashboard?periodo=7");
    expect(dashboardHref("funnel", "7", null)).toBe("/dashboard?tab=funnel");
  });

  it("na aba Qualidade, o período marcado e os links mantêm a unidade", () => {
    render(
      <DirectorLiteChrome now={NOW} tab="quality" period="7d" branchId="branch-centro" branches={BRANCHES}>
        <p>conteúdo</p>
      </DirectorLiteChrome>,
    );
    expect(screen.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("aria-current", "page");
    const periods = within(screen.getByRole("navigation", { name: "Período" }));
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "30 dias" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=30&unidade=branch-centro");
    const units = within(screen.getByRole("navigation", { name: "Unidade" }));
    expect(units.getByRole("link", { name: "Barra da Tijuca" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=7&unidade=branch-barra");
  });

  it("sem unidades no escopo, o filtro de unidade some", () => {
    render(
      <DirectorLiteChrome now={NOW} tab="quality" period="today" branchId={null} branches={[]}>
        <p>conteúdo</p>
      </DirectorLiteChrome>,
    );
    expect(screen.queryByRole("navigation", { name: "Unidade" })).not.toBeInTheDocument();
  });

  it("Detalhada, fila, intervalo e exportar levam à tela antiga com o mesmo período", () => {
    render(<QualityToolbar legacyHref="/dashboard?tab=quality&period=7&legado=1" detailedHref="/dashboard?tab=quality&period=7&vista=detalhada&legado=1" />);
    const tools = within(screen.getByRole("navigation", { name: "Vista e ferramentas da qualidade" }));
    expect(tools.getByRole("link", { name: "Detalhada" })).toHaveAttribute("href", "/dashboard?tab=quality&period=7&vista=detalhada&legado=1");
    for (const name of ["Fila: todas", "Intervalo", "Exportar"]) {
      expect(tools.getByRole("link", { name })).toHaveAttribute("href", "/dashboard?tab=quality&period=7&legado=1");
    }
    expect(tools.getByText("Simples")).toHaveAttribute("aria-current", "true");
  });
});
