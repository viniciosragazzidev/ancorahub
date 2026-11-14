// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
const actions = vi.hoisted(() => ({
  submitRecommendedTemplatesAction: vi.fn(async () => ({ success: true, submitted: ["a", "b"], failed: [] })),
  updateTurboSettingsAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("../actions", () => actions);
vi.mock("@/components/arc/switch/switch", () => ({
  Switch: ({ checked, onCheckedChange, disabled, ...props }: { checked: boolean; disabled?: boolean; onCheckedChange: (value: boolean) => void } & Record<string, unknown>) => (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} aria-labelledby={props["aria-labelledby"] as string} onClick={() => onCheckedChange(!checked)} />
  ),
}));

import { TurboAdminLite } from "./turbo-admin-lite";

const row = (name: string, status: string) => ({ name, label: name, touch: "t0", expectedCategory: "UTILITY", status, category: null, quality: null, rejectedReason: null, body: "Olá", buttons: ["Sim"] });
const data = (canEdit: boolean) => ({ settings: { enabled: true, cadence: false, learn: false, companyDisplayName: "", silenceFollowUp: true, silenceFollowUpChannel: "same" }, templates: [row("primeira", "APPROVED"), row("lembrete", "MISSING"), row("reengajamento", "REJECTED")], metaConnected: true, canEdit }) as never;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("qualificação turbo Lite", () => {
  it("envia os que faltam pela mesma ação", async () => {
    render(<TurboAdminLite data={data(true)} />);
    expect(screen.getByText("Templates da qualificação (1 de 3 aprovados)")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar 2 à Meta" }));
    });
    expect(actions.submitRecommendedTemplatesAction).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("2 templates enviados para aprovação da Meta.");
    expect(fire).toHaveBeenCalledWith("confirm");
  });

  it("falha do envio fica na seção com Tentar de novo", async () => {
    actions.submitRecommendedTemplatesAction.mockResolvedValueOnce({ success: false, error: "O número oficial não está conectado." } as never);
    render(<TurboAdminLite data={data(true)} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enviar 2 à Meta" }));
    });
    expect(screen.getByRole("alert")).toHaveTextContent("O número oficial não está conectado. Os templates continuam como estavam.");
    expect(fire).toHaveBeenCalledWith("error");
    expect(toast.error).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    });
    expect(actions.submitRecommendedTemplatesAction).toHaveBeenCalledTimes(2);
  });

  it("opção salva confirma no painel; se falhar, volta e mostra a causa", async () => {
    actions.updateTurboSettingsAction.mockResolvedValueOnce({ success: false, error: "Sem permissão." } as never);
    render(<TurboAdminLite data={data(true)} />);
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    const learn = () => screen.getAllByRole("switch")[2]!;
    await act(async () => {
      fireEvent.click(learn());
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Sem permissão. As opções anteriores continuam valendo.");
    expect(learn()).toHaveAttribute("aria-checked", "false");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    });
    expect(learn()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Configuração salva")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("quem não edita não envia e vê as opções travadas", () => {
    render(<TurboAdminLite data={data(false)} />);
    expect(screen.queryByRole("button", { name: /à Meta/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(screen.getAllByRole("switch")[0]).toBeDisabled();
    expect(screen.getByText("Só o diretor altera estas opções.")).toBeInTheDocument();
  });
});
