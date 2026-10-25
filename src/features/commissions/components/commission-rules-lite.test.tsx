// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const actions = vi.hoisted(() => ({
  createCommissionRuleAction: vi.fn(async () => ({ success: true })),
  updateCommissionRuleAction: vi.fn(async () => ({ success: true })),
  toggleCommissionRuleAction: vi.fn(async () => ({ success: true })),
  deleteCommissionRuleAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("@/features/commissions/actions", () => actions);
vi.mock("@/features/post-sale/actions", () => ({ updatePostSaleSettingsAction: vi.fn(async () => ({})) }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({
  default: ({ options, value, onValueChange }: { options: { value: string; label: string }[]; value: string; onValueChange: (value: string) => void }) => (
    <div role="radiogroup">{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div>
  ),
}));

import { CommissionRulesLite } from "./commission-rules-lite";

const base = { tenantId: "t", carrierId: null, carrierName: null, planId: null, planName: null, createdBy: "u", createdAt: new Date("2026-10-01T12:00:00Z"), updatedAt: new Date("2026-10-01T12:00:00Z") };
const RULES = [
  { ...base, id: "r1", name: "Padrão individual", type: "escalonada" as const, percentages: [100, 25, 5], appliesToAll: true, active: true },
  { ...base, id: "r2", name: "Amil PME", carrierId: "c1", carrierName: "Amil", type: "unica" as const, percentages: [120], appliesToAll: false, active: false },
];
const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("regras de comissão Lite", () => {
  it("lista, filtra e exclui só depois da confirmação", async () => {
    render(<CommissionRulesLite rules={RULES} carriers={[{ id: "c1", name: "Amil" }]} />);
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    expect(within(table()).getByText("M1 100% · M2 25% · M3 5%")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar regra de comissão" }), { target: { value: "amil" } });
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(within(table()).getByRole("button", { name: "Ações da regra Amil PME" }));
    fireEvent.click(within(table()).getByRole("menuitem", { name: "Excluir" }));
    expect(actions.deleteCommissionRuleAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir regra" }));
    });
    expect((actions.deleteCommissionRuleAction.mock.calls[0] as unknown as [unknown, FormData])[1].get("ruleId")).toBe("r2");
  });

  it("nova regra envia os mesmos campos (percentuais em JSON e tipo)", async () => {
    render(<CommissionRulesLite rules={RULES} carriers={[{ id: "c1", name: "Amil" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Nova regra" }));
    const panel = within(screen.getByRole("dialog", { name: "Nova regra de comissão" }));
    fireEvent.change(panel.getByRole("textbox", { name: "Nome da regra" }), { target: { value: "Nova" } });
    fireEvent.click(panel.getByRole("radio", { name: "Única" }));
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Criar regra de comissão" }));
    });
    const data = (actions.createCommissionRuleAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("name")).toBe("Nova");
    expect(data.get("type")).toBe("unica");
    expect(data.get("percentages")).toBe("[100]");
    expect(toast.success).toHaveBeenCalledWith("Regra de comissão salva.");
  });
});
