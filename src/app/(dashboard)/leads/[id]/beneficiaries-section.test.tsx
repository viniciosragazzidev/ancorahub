// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addLeadBeneficiaryAction: vi.fn(async () => ({ id: "dep-2" })),
  removeLeadBeneficiaryAction: vi.fn(async () => ({})),
  updateLeadBeneficiaryAction: vi.fn(async () => ({})),
}));
vi.mock("@/features/post-sale/actions", () => actions);
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/arc/date-picker/date-picker", () => ({ DatePicker: ({ label }: { label: string }) => <button type="button" aria-label={label}>{label}</button> }));

import { BeneficiariesSection } from "./beneficiaries-section";

const holder = { id: "h-1", name: "Ana Souza", birthDate: "1990-04-10", age: null, relationship: "titular", isHolder: true, hasCpf: true };
const child = { id: "d-1", name: "Pedro Souza", birthDate: null, age: 8, relationship: "filho", isHolder: false, hasCpf: false };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("BeneficiariesSection", () => {
  it("mostra só os cards das pessoas e deixa o formulário fechado até tocar em Adicionar dependente", async () => {
    render(<BeneficiariesSection leadId="lead-1" contactName="Ana Souza" initialBeneficiaries={[holder, child]} />);

    const list = screen.getByRole("list", { name: "Pessoas da contratação" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Pedro Souza")).toBeTruthy();
    expect(within(list).getByText(/8 anos · Filho\(a\)/)).toBeTruthy();
    expect(screen.queryByLabelText("Nome do dependente")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar dependente" }));
    const sheet = await screen.findByRole("dialog", { name: "Adicionar dependente" });
    expect(within(sheet).getByLabelText("Nome do dependente")).toBeTruthy();
  });

  it("pede para confirmar o titular quando o contato ainda não foi confirmado", async () => {
    render(<BeneficiariesSection leadId="lead-1" contactName="Ana Souza" initialBeneficiaries={[]} />);

    expect(screen.getByText("Contato do lead · confirme a data de nascimento")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar titular" }));
    const sheet = await screen.findByRole("dialog", { name: "Completar dados do titular" });
    expect((within(sheet).getByLabelText("Titular") as HTMLInputElement).value).toBe("Ana Souza");
  });

  it("salva o dependente, fecha o painel e mostra o novo card", async () => {
    render(<BeneficiariesSection leadId="lead-1" contactName="Ana Souza" initialBeneficiaries={[holder]} />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar dependente" }));
    const sheet = await screen.findByRole("dialog", { name: "Adicionar dependente" });
    fireEvent.change(within(sheet).getByLabelText("Nome do dependente"), { target: { value: "Clara Souza" } });
    fireEvent.change(within(sheet).getByLabelText("Idade, se não souber a data"), { target: { value: "5" } });
    fireEvent.click(within(sheet).getByRole("button", { name: "Adicionar dependente" }));

    await waitFor(() => expect(actions.addLeadBeneficiaryAction).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-1", name: "Clara Souza", age: 5, isHolder: false })));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Adicionar dependente" })).toBeNull());
    expect(within(screen.getByRole("list", { name: "Pessoas da contratação" })).getByText("Clara Souza")).toBeTruthy();
  });
});
