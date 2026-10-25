// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DomainDashboardLite } from "./domain-dashboard-lite";

afterEach(cleanup);

const data = { title: "Visão de tarefas", description: "Execução e pendências do período.", metrics: [{ label: "Em aberto", value: 12 }, { label: "Com prazo", value: 3 }, { label: "Criadas", value: 9 }], actionHref: "/tarefas" };

describe("DomainDashboardLite", () => {
  it("mostra os números e o atalho, sem repetir o título do cabeçalho", () => {
    render(<DomainDashboardLite data={data} actionLabel="Abrir tarefas" />);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByText("Execução e pendências do período.")).toBeInTheDocument();
    expect(screen.getAllByText(/Em aberto|Com prazo|Criadas/)).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Abrir tarefas" })).toHaveAttribute("href", "/tarefas");
  });
});
