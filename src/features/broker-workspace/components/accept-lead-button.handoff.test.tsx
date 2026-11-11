// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), remember: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: mocks.accept }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/features/broker-workspace/whatsapp-handoff/handoff-store", () => ({ useAcceptHandoffEnabled: () => true, rememberWhatsAppHandoff: mocks.remember }));

import { AcceptLeadButton } from "./accept-lead-button";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("AcceptLeadButton com o aceite com contador", () => {
  it("não abre nada no clique: guarda o link e vai para a tela do lead", async () => {
    const open = vi.spyOn(window, "open");
    const url = "https://web.whatsapp.com/send?phone=5521997216462&text=Ol%C3%A1";
    mocks.accept.mockResolvedValue({ success: true, whatsappUrl: url });
    render(<AcceptLeadButton leadId="l1">Aceitar e chamar no WhatsApp</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar no WhatsApp" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
    expect(open).not.toHaveBeenCalled();
    expect(mocks.remember).toHaveBeenCalledWith("l1", url);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("sem WhatsApp no cadastro, avisa como antes", async () => {
    mocks.accept.mockResolvedValue({ success: true });
    render(<AcceptLeadButton leadId="l1">Aceitar</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
    expect(mocks.remember).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Lead aceito. Ele não tem WhatsApp no cadastro: veja o contato na ficha.");
  });
});
