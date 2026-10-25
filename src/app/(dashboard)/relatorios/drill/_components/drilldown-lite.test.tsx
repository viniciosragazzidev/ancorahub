// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

import { DrilldownLite, liteExplanation, liteStatusLabel } from "./drilldown-lite";

afterEach(cleanup);

const rows = Array.from({ length: 25 }, (_, index) => ({
  id: `l${index + 1}`,
  nome: `Lead ${index + 1}`,
  status: "in_contact",
  brokerName: index === 0 ? null : "Ana Souza",
  branchName: "Centro",
  // 22:30 em Brasília do dia 24 (já dia 25 em UTC).
  createdAt: "2026-10-25T01:30:00.000Z",
}));

describe("DrilldownLite", () => {
  it("total, corretores, leads paginados e linha que abre o lead", () => {
    render(<DrilldownLite explanation="Leads no estágio `converted` — numerador." total={300} rows={rows} brokers={[{ brokerId: "b1", brokerName: "Ana Souza", activeLeads: 40, capacity: 30 }]} />);
    expect(screen.getByText("Leads no estágio converted: numerador.")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getAllByText("+10").length).toBeGreaterThan(0);
    const table = document.querySelectorAll('[data-lite="table"]')[1] as HTMLElement;
    expect(table.querySelectorAll("tbody tr")).toHaveLength(20);
    expect(screen.getAllByText("24/10/2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sem corretor").length).toBeGreaterThan(0);
    fireEvent.click(table.querySelectorAll("tbody tr")[1]!.querySelector("td:nth-child(2)")!);
    expect(push).toHaveBeenCalledWith("/leads/l2");
    expect(screen.getByText("Exibindo 25 de 300 registros.")).toBeInTheDocument();
  });

  it("textos do Lite: sem crase, sem travessão, status em caixa de frase", () => {
    expect(liteExplanation("a `b` — c")).toBe("a b: c");
    expect(liteStatusLabel("in_contact")).toBe("Em atendimento");
    expect(liteStatusLabel("desconhecido")).toBe("desconhecido");
  });
});
