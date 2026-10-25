// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const actions = vi.hoisted(() => ({
  createWhatsappFlowAction: vi.fn(async () => ({ success: true })),
  updateWhatsappFlowAction: vi.fn(async () => ({ success: true })),
  deleteWhatsappFlowAction: vi.fn(async () => ({ success: true })),
}));
vi.mock("../actions", () => actions);

import { WhatsappFlowsLite } from "./whatsapp-flows-lite";

const FLOWS = [{ id: "f1", name: "Fluxo Lead Ads", triggerType: "lead_ads", status: "active", configuration: {}, createdAt: new Date("2026-10-01T12:00:00Z") }];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("fluxos de WhatsApp Lite", () => {
  it("modelo configurado não pode ser adicionado de novo e o novo fluxo usa a mesma ação", async () => {
    render(<WhatsappFlowsLite initialFlows={FLOWS} />);
    expect(screen.queryByRole("button", { name: "Adicionar Lead Ads" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Qualificação B2B" }));
    const panel = within(screen.getByRole("dialog"));
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Salvar fluxo" }));
    });
    expect(actions.createWhatsappFlowAction).toHaveBeenCalledWith({ name: "Fluxo Qualificação B2B", triggerType: "b2b_qualification", status: "active", configuration: { minVidas: 3, askCnpj: true } });
  });

  it("pausa pela mesma ação e exclui só depois da confirmação Lite", async () => {
    render(<WhatsappFlowsLite initialFlows={FLOWS} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    });
    expect(actions.updateWhatsappFlowAction).toHaveBeenCalledWith("f1", { status: "paused" });
    fireEvent.click(screen.getByRole("button", { name: "Excluir Fluxo Lead Ads" }));
    expect(actions.deleteWhatsappFlowAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir fluxo" }));
    });
    expect(actions.deleteWhatsappFlowAction).toHaveBeenCalledWith("f1");
  });
});
