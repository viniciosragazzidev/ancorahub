// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => vi.fn() }));
const actions = vi.hoisted(() => ({
  listIntegrationDeliveriesAction: vi.fn(),
}));
vi.mock("../../integrations-actions", () => ({
  createIntegrationAction: vi.fn(),
  toggleIntegrationAction: vi.fn(),
  revokeIntegrationAction: vi.fn(),
  listIntegrationDeliveriesAction: actions.listIntegrationDeliveriesAction,
}));

import { IntegrationDeliveriesLite } from "./integration-deliveries-lite";
import { IntegrationsLite } from "./integrations-lite";

const deliveries = [
  { id: "d1", receivedAt: new Date("2026-11-25T14:58:00.000Z"), situation: "entered", reason: null, leadId: "lead-1" },
  { id: "d2", receivedAt: new Date("2026-11-25T14:50:00.000Z"), situation: "not_entered", reason: "Nenhuma filial ou fila ativa para receber o lead", leadId: null },
  { id: "d3", receivedAt: new Date("2026-11-25T14:40:00.000Z"), situation: "duplicate", reason: "O contato já era um lead e voltou a chegar", leadId: "lead-old" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Recebidos da fonte de captura", () => {
  it("mostra situação, motivo e link do lead, e o filtro Só problemas pede de novo ao servidor", async () => {
    actions.listIntegrationDeliveriesAction.mockResolvedValue({ success: true, deliveries });
    await act(async () => {
      render(<IntegrationDeliveriesLite credentialId="cred-1" />);
    });
    expect(actions.listIntegrationDeliveriesAction).toHaveBeenLastCalledWith({ id: "cred-1", onlyProblems: false });
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("Entrou")).toBeInTheDocument();
    expect(within(table).getByText("Não entrou")).toBeInTheDocument();
    expect(within(table).getByText("Duplicado")).toBeInTheDocument();
    expect(within(table).getByText("Nenhuma filial ou fila ativa para receber o lead")).toBeInTheDocument();
    expect(within(table).getAllByRole("link", { name: "Abrir lead" }).map((link) => link.getAttribute("href"))).toEqual(["/leads/lead-1", "/leads/lead-old"]);

    actions.listIntegrationDeliveriesAction.mockResolvedValue({ success: true, deliveries: [] });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Só problemas" }));
    });
    expect(actions.listIntegrationDeliveriesAction).toHaveBeenLastCalledWith({ id: "cred-1", onlyProblems: true });
    expect(screen.getByRole("button", { name: "Só problemas" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Nenhum problema nos últimos envios.").length).toBeGreaterThan(0);
  });

  it("falha mostra a causa, o que continua valendo e Tentar de novo", async () => {
    actions.listIntegrationDeliveriesAction.mockResolvedValueOnce({ success: false, error: "Não foi possível carregar os recebidos." });
    await act(async () => {
      render(<IntegrationDeliveriesLite credentialId="cred-1" />);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível carregar os recebidos.A fonte continua recebendo leads normalmente.");
    actions.listIntegrationDeliveriesAction.mockResolvedValueOnce({ success: true, deliveries });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    });
    expect(actions.listIntegrationDeliveriesAction).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a linha da fonte mostra o último recebimento ou Nunca recebeu", () => {
    const base = { source: "landing_page", branchId: null, branchName: null, status: "active" as const, tokenPrefix: "lp_123", createdAt: new Date() };
    render(<IntegrationsLite branches={[]} integrations={[
      { ...base, id: "11111111-1111-4111-8111-111111111111", name: "LP Centro", lastReceivedAt: new Date(Date.now() - 5 * 60_000) },
      { ...base, id: "22222222-2222-4222-8222-222222222222", name: "Pixel novo", lastReceivedAt: null },
    ]} />);
    const list = within(screen.getByRole("list", { name: "Fontes de captura" }));
    expect(list.getByText(/^Último recebimento há [45] min/)).toBeInTheDocument();
    expect(list.getByText("Nunca recebeu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver recebidos" })).toBeEnabled();
  });
});
