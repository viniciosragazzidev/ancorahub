// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/leads/management-actions", () => ({ reassignLeadAction: vi.fn(async () => ({})) }));
vi.mock("@/components/arc/avatar/avatar", () => ({ Avatar: ({ name }: { name: string }) => <span role="img" aria-label={name} /> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ open, title, children }: { open?: boolean; title: string; children: ReactNode }) => (open ? <section aria-label={title}>{children}</section> : null),
}));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, variant: _variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button type="button" {...props}>{children}</button>,
}));
vi.mock("@/components/arc/search-field/search-field", () => ({
  SearchField: ({ label, value, onValueChange }: { label: string; value: string; onValueChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} />
  ),
}));
vi.mock("@/components/light/light-motion", () => ({ LitePress: ({ children }: { children: ReactNode }) => <>{children}</> }));

import { ManagerLeadTransferForm } from "./manager-lead-transfer-form";

const brokers = [
  { id: "b1", name: "Paulo Dias", image: null, availability: "available" },
  { id: "b2", name: "Ana Souza", image: null, availability: "paused" },
];

afterEach(() => cleanup());

describe("ManagerLeadTransferForm (Lite)", () => {
  it("opens a sheet with the unit's brokers, their availability and a search", () => {
    render(<ManagerLeadTransferForm leadId="lead-1" leadName="Marina Alves" brokers={brokers} />);

    fireEvent.click(screen.getByRole("button", { name: "Repassar lead" }));
    expect(screen.getByRole("list", { name: "Corretores da unidade" })).toBeTruthy();
    expect(screen.getByText("Disponível")).toBeTruthy();
    expect(screen.getByText("Pausado")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.change(screen.getByLabelText("Buscar corretor"), { target: { value: "ana" } });
    expect(screen.queryByText("Paulo Dias")).toBeNull();
    expect(screen.getByText("Ana Souza")).toBeTruthy();
  });

  it("enables the submit only after a broker is chosen", () => {
    render(<ManagerLeadTransferForm leadId="lead-1" leadName="Marina Alves" brokers={brokers} />);
    fireEvent.click(screen.getByRole("button", { name: "Repassar lead" }));

    const submit = screen.getByRole("button", { name: "Escolha um corretor" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Paulo Dias/ }));
    expect((screen.getByRole("button", { name: "Repassar para Paulo Dias" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says so when the unit has no active brokers", () => {
    render(<ManagerLeadTransferForm leadId="lead-1" leadName="Marina Alves" brokers={[]} />);
    expect(screen.getByText("Não há corretores ativos nesta unidade.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Repassar lead" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
