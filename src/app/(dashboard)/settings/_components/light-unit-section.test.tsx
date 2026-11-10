// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/broker-unit-change/actions", () => ({ changeOwnBranchAction: vi.fn() }));
vi.mock("@/components/arc/radio-cards/radio-cards", () => ({
  default: ({ options, value, onValueChange }: { options: { value: string; label: string }[]; value: string | null; onValueChange: (value: string) => void }) => (
    <div role="radiogroup">{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value} onClick={() => onValueChange(option.value)}>{option.label}</button>)}</div>
  ),
}));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  default: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => (open ? <div role="dialog" aria-label={title}>{children}</div> : null),
}));

import { LightUnitSection } from "./light-unit-section";

const base = { current: { id: "unit-a", name: "Centro" }, options: [{ id: "unit-b", name: "Barra" }, { id: "unit-c", name: "Norte" }], openDutySlots: 2 };

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("LightUnitSection", () => {
  it("shows the current unit and keeps the change disabled until a unit is picked", () => {
    render(<LightUnitSection {...base} changeAction={vi.fn()} />);
    expect(screen.getByText("Centro")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Trocar de unidade" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Barra" }));
    expect((screen.getByRole("button", { name: "Trocar para Barra" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("confirms in a sheet that says what changes, then shows the result in place", async () => {
    const changeAction = vi.fn(async () => ({ ok: true as const, branchName: "Barra", changed: true, releasedAssignments: 2 }));
    render(<LightUnitSection {...base} changeAction={changeAction} />);
    fireEvent.click(screen.getByRole("radio", { name: "Barra" }));
    fireEvent.click(screen.getByRole("button", { name: "Trocar para Barra" }));
    const sheet = screen.getByRole("dialog", { name: "Trocar para Barra?" });
    expect(sheet.textContent).toContain("Você sai de 2 vagas de plantão em Centro.");
    expect(sheet.textContent).toContain("Seus leads e atendimentos continuam com você.");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Trocar de unidade" })); });
    expect(changeAction).toHaveBeenCalledWith("unit-b");
    expect(screen.getByRole("status").textContent).toBe("Pronto, agora você está em Barra. Você saiu de 2 vagas de plantão em Centro.");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the server refusal", async () => {
    const changeAction = vi.fn(async () => ({ ok: false as const, error: "A troca de unidade está desligada no momento. Fale com a gestão." }));
    render(<LightUnitSection {...base} changeAction={changeAction} />);
    fireEvent.click(screen.getByRole("radio", { name: "Norte" }));
    fireEvent.click(screen.getByRole("button", { name: "Trocar para Norte" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Trocar de unidade" })); });
    expect(screen.getByRole("alert").textContent).toContain("desligada");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("explains when there is nowhere to go or no current unit", () => {
    const { rerender } = render(<LightUnitSection {...base} options={[]} changeAction={vi.fn()} />);
    expect(screen.getByText("Não há outra unidade ativa na sua corretora.")).toBeTruthy();
    rerender(<LightUnitSection {...base} current={null} changeAction={vi.fn()} />);
    expect(screen.getByText("Seu cadastro está sem unidade. Peça à gestão para corrigir.")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
