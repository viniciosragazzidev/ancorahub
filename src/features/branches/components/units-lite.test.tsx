// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
const actions = vi.hoisted(() => ({
  createBranchAction: vi.fn(async () => ({ message: "Filial criada." })),
  updateBranchAction: vi.fn(async () => ({ message: "ok" })),
  toggleBranchAction: vi.fn(async () => ({ message: "ok" })),
  toggleAcceptingLeadsAction: vi.fn(async () => ({ success: true })),
  toggleAutoDistributeAction: vi.fn(async () => ({ success: true })),
  toggleDistributionHubAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/features/branches/actions", () => actions);

import { UnitsLite, type UnitLite } from "./units-lite";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const branch: UnitLite = { id: "b1", name: "Centro", externalId: "FIL-01", status: "active", memberCount: 4, acceptingLeads: true, autoDistribute: false, isDistributionHub: false, availableBrokers: 2, activeLeads: 9, newLeads: 1 };

describe("UnitsLite", () => {
  it("a chave de recebimento chama a mesma ação; ver unidade leva ao perfil", async () => {
    render(<UnitsLite branches={[branch]} canManage />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Recebe leads: ligado" })); });
    const data = (actions.toggleAcceptingLeadsAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("branchId")).toBe("b1");
    expect(screen.getByRole("status")).toHaveTextContent("Configuração atualizada");
    expect(fire).toHaveBeenCalledWith("confirm");
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Ver unidade Centro" })).toHaveAttribute("href", "/unidades/b1");
  });

  it("sem gestão: chaves só leitura, sem editar nem nova filial", () => {
    render(<UnitsLite branches={[branch]} canManage={false} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova filial/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Centro" })).not.toBeInTheDocument();
  });

  it("chave que falha mostra a causa ao lado e Tentar de novo", async () => {
    actions.toggleAutoDistributeAction.mockResolvedValueOnce({ error: "A unidade não tem corretores disponíveis." } as never);
    render(<UnitsLite branches={[branch]} canManage />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Distribuição automática: desligado" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("A unidade não tem corretores disponíveis. A unidade continua como estava.");
    expect(fire).toHaveBeenCalledWith("error");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" })); });
    expect(actions.toggleAutoDistributeAction).toHaveBeenCalledTimes(2);
    expect(toast.error).not.toHaveBeenCalled();
  });
});
