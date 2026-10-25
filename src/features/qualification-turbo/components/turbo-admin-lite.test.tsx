// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
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
const data = (canEdit: boolean) => ({ settings: { enabled: true, cadence: false, learn: false, companyDisplayName: "" }, templates: [row("primeira", "APPROVED"), row("lembrete", "MISSING"), row("reengajamento", "REJECTED")], metaConnected: true, canEdit }) as never;

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
  });

  it("quem não edita não envia e vê as opções travadas", () => {
    render(<TurboAdminLite data={data(false)} />);
    expect(screen.queryByRole("button", { name: /à Meta/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
    expect(screen.getAllByRole("switch")[0]).toBeDisabled();
    expect(screen.getByText("Só o diretor altera estas opções.")).toBeInTheDocument();
  });
});
