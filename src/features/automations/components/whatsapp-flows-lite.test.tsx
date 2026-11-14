// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
const fire = vi.hoisted(() => vi.fn(() => ({ motion: false, celebrate: false })));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => fire }));
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
    expect(screen.getByRole("status")).toHaveTextContent("Fluxo Qualificação B2B criado e ativo");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("pausa pela mesma ação e exclui só depois da confirmação Lite", async () => {
    render(<WhatsappFlowsLite initialFlows={FLOWS} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pausar" }));
    });
    expect(actions.updateWhatsappFlowAction).toHaveBeenCalledWith("f1", { status: "paused" });
    expect(screen.getByRole("status")).toHaveTextContent("Fluxo Lead Ads pausado");
    expect(fire).toHaveBeenCalledWith("confirm");
    fireEvent.click(screen.getByRole("button", { name: "Excluir Fluxo Lead Ads" }));
    expect(actions.deleteWhatsappFlowAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir fluxo" }));
    });
    expect(actions.deleteWhatsappFlowAction).toHaveBeenCalledWith("f1");
  });

  it("falha ao criar fica no painel com a causa e Tentar de novo", async () => {
    actions.createWhatsappFlowAction.mockResolvedValueOnce({ success: false, error: "Já existe um fluxo com esse gatilho." } as never);
    render(<WhatsappFlowsLite initialFlows={FLOWS} />);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Qualificação B2B" }));
    const panel = within(screen.getByRole("dialog"));
    await act(async () => {
      fireEvent.click(panel.getByRole("button", { name: "Salvar fluxo" }));
    });
    expect(panel.getByRole("alert")).toHaveTextContent("Já existe um fluxo com esse gatilho. A configuração continua aqui.");
    expect(panel.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(fire).toHaveBeenCalledWith("error");
    expect(toast.error).not.toHaveBeenCalled();
  });
});
