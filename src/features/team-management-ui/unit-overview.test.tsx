// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <div role="img" aria-label={name} /> }));
vi.mock("@/components/arc/empty-state/empty-state", () => ({ EmptyState: ({ title }: { title: string }) => <section><strong>{title}</strong></section> }));

import { buildUnitOverview, type TeamMetricsInput } from "./build-overview";
import { UnitOverviewView } from "./unit-overview";

afterEach(() => cleanup());

const identity = {
  activeBrokers: 9,
  supervisors: [
    { supervisorId: "sup-ana", name: "Ana", image: null, teamName: "Equipe Centro", brokers: 5 },
    { supervisorId: "sup-bruno", name: "Bruno", image: null, teamName: "Equipe Norte", brokers: 4 },
  ],
  unassigned: [{ userId: "b-1", name: "Diego" }],
};

describe("UnitOverviewView", () => {
  it("without metrics shows the structure, 'Em breve' on the KPIs and 'Indicadores em breve' per team, with no fake score", () => {
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics: null })} />);

    expect(screen.getByText("Indicadores de saúde chegam em breve.")).toBeTruthy();
    expect(screen.getAllByText("Indicadores em breve").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Em breve").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Sem equipe" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Abrir equipe/ })[0]?.getAttribute("href")).toBe("/gestao/equipes/sup-ana");
  });

  it("with metrics lists the critical team first and shows the exception phrase", () => {
    const metrics = new Map<string, TeamMetricsInput>([
      ["sup-ana", { score: 90, band: "excelente", sla: "5 min", acceptRate: "95%", conversion: "30%", trend: "up", strengths: ["Aceite rápido"], concerns: [] }],
      ["sup-bruno", { score: 40, band: "critico", sla: "30 min", acceptRate: "50%", conversion: "8%", trend: "down", strengths: [], concerns: ["Aceite lento"] }],
    ]);
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics })} />);

    expect(screen.getByText("1 equipe precisa de atenção")).toBeTruthy();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(headings[0]).toBe("Equipe Norte");
    expect(screen.getByText("Crítico")).toBeTruthy();
    expect(screen.getByText("Aceite lento")).toBeTruthy();
  });

  it("renders the supervisor comparison as a table with no podium", () => {
    render(<UnitOverviewView overview={buildUnitOverview({ ...identity, metrics: null })} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Ana", "Bruno"]);
    expect(document.body.textContent).not.toMatch(/pódio/i);
    expect(document.body.textContent).not.toContain("—");
  });
});
