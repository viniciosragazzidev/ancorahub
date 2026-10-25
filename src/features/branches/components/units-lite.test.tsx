// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

afterEach(cleanup);

const branch: UnitLite = { id: "b1", name: "Centro", externalId: "FIL-01", status: "active", memberCount: 4, acceptingLeads: true, autoDistribute: false, isDistributionHub: false, availableBrokers: 2, activeLeads: 9, newLeads: 1 };

describe("UnitsLite", () => {
  it("a chave de recebimento chama a mesma ação; ver unidade leva ao perfil", async () => {
    render(<UnitsLite branches={[branch]} canManage />);
    await act(async () => { fireEvent.click(screen.getByRole("switch", { name: "Recebe leads: ligado" })); });
    const data = (actions.toggleAcceptingLeadsAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("branchId")).toBe("b1");
    expect(screen.getByRole("link", { name: "Ver unidade Centro" })).toHaveAttribute("href", "/unidades/b1");
  });

  it("sem gestão: chaves só leitura, sem editar nem nova filial", () => {
    render(<UnitsLite branches={[branch]} canManage={false} />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nova filial/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Centro" })).not.toBeInTheDocument();
  });
});
