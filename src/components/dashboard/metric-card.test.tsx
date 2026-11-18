// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InsightStrip, InsightValue } from "./insight-strip";
import { MetricGrid, StatCard } from "./metric-card";

afterEach(cleanup);

const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;

describe("StatCard (docs/design-system.md § Stat / KPI Tile)", () => {
  it("mostra o número pronto, em Geist Mono 24px com dígitos alinhados", () => {
    render(<StatCard label="Leads hoje" value={47} />);
    const value = screen.getByText("47");
    expect(value).toHaveClass("font-ds-mono", "text-ds-heading-sm", "tabular-nums");
  });

  it("chip azul por padrão e semântico só quando pedido", () => {
    const { rerender, container } = render(<StatCard label="Leads" value={1} icon={Icon} />);
    const chip = () => container.querySelector(".ui-metric-card-icon")!;
    expect(chip()).toHaveClass("size-7", "rounded-ds-buttons", "bg-ds-powder-blue", "text-ds-electric-blue");
    rerender(<StatCard label="SLA vencido" value={3} icon={Icon} tone="warning" />);
    expect(chip()).toHaveClass("bg-ds-amber-wash", "text-ds-amber-ink");
  });

  it("card informativo não se mexe no hover", () => {
    const { container } = render(<StatCard label="Leads" value={1} icon={Icon} sublabel="hoje" />);
    expect(container.innerHTML).not.toMatch(/hover:shadow|hover:-translate|group-hover|hover:bg-card/);
  });

  it("o (i) tem nome acessível", () => {
    render(<StatCard label="Conversão" value="18%" info="Vendas sobre leads recebidos." />);
    expect(screen.getByRole("button", { name: "Sobre Conversão" })).toBeInTheDocument();
  });
});

describe("MetricGrid", () => {
  it("agrupa as células num container só, com nome para leitor de tela", () => {
    render(
      <MetricGrid label="Números de hoje" columns={3}>
        <StatCard variant="overview" label="A" value={1} />
        <StatCard variant="overview" label="B" value={2} />
        <StatCard variant="overview" label="C" value={3} />
      </MetricGrid>,
    );
    const grid = screen.getByRole("region", { name: "Números de hoje" });
    expect(grid).toHaveAttribute("data-slot", "metric-grid");
    expect(grid).toHaveClass("lg:grid-cols-3", "border", "border-border");
    expect(grid.children).toHaveLength(3);
  });
});

describe("InsightStrip", () => {
  it("rótulo e números citados no azul, o resto neutro", () => {
    render(
      <InsightStrip label="Sugestões • Âncora IA">
        <p>Conversão de <InsightValue>18%</InsightValue>.</p>
      </InsightStrip>,
    );
    expect(screen.getByRole("region", { name: "Sugestões • Âncora IA" })).toHaveClass("bg-ds-paper-mist", "border-border");
    expect(screen.getByText("18%")).toHaveClass("text-ds-electric-blue", "tabular-nums");
  });

  it("anuncia mudança só quando live", () => {
    const { rerender } = render(<InsightStrip label="Em resumo"><p>a</p></InsightStrip>);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<InsightStrip label="Em resumo" live><p>a</p></InsightStrip>);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
