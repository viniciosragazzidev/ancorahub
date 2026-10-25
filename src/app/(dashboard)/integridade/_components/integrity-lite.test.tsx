// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IntegrityLite, actionLabel, entityLabel } from "./integrity-lite";

afterEach(cleanup);

const logs = Array.from({ length: 12 }, (_, index) => ({
  id: `log-${index}`,
  acao: index === 0 ? "start_service" : "update",
  entidade: "lead_task",
  entidadeId: index === 0 ? "abcdef1234567890" : null,
  userName: `Pessoa ${index}`,
  // 22:30 em Brasília do dia 24 (já dia 25 em UTC).
  createdAt: "2026-10-25T01:30:00.000Z",
}));

describe("IntegrityLite", () => {
  it("números, feed paginado com hora de Brasília e atalho de configurações", () => {
    render(<IntegrityLite data={{ stalled: 3, unworked: 0, totalLeads: 1200, leadsTrend: [1, 2, 3, 4, 5, 6, 7], auditsTrend: [1, 1, 1, 1, 1, 1, 1], logs }} />);
    expect(screen.getByText("Atenção: 3 estagnados")).toBeInTheDocument();
    expect(screen.queryByText(/Crítico/)).not.toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Eventos de auditoria" });
    expect(list.querySelectorAll("li")).toHaveLength(10);
    expect(screen.getAllByText("24/10/2026, 22:30").length).toBeGreaterThan(0);
    expect(screen.getByText("Início de atendimento")).toBeInTheDocument();
    expect(screen.getByText(/ID abcdef12/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Próxima/i }));
    expect(screen.getByRole("list", { name: "Eventos de auditoria" }).querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Acessar configurações/ })).toHaveAttribute("href", "/settings");
  });

  it("rótulos em caixa de frase", () => {
    expect(entityLabel("lead_task")).toBe("Lead task");
    expect(actionLabel("custom_action")).toBe("Custom action");
  });
});
