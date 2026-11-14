// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), remember: vi.fn(), report: vi.fn(), go: vi.fn(), prepare: vi.fn(), leave: vi.fn() }));
const device = vi.hoisted(() => ({ current: "desktop" as "desktop" | "mobile" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: mocks.accept }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/features/broker-workspace/whatsapp-handoff/handoff-store", () => ({ useAcceptHandoffEnabled: () => true, rememberWhatsAppHandoff: mocks.remember, reportWhatsAppOpenFailed: mocks.report }));
vi.mock("@/lib/whatsapp-open", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/whatsapp-open")>();
  return {
    ...actual,
    currentWhatsAppDevice: () => device.current,
    prepareWhatsAppWindow: (...args: Parameters<typeof actual.prepareWhatsAppWindow>) => { mocks.prepare(...args); return { go: mocks.go, cancel: vi.fn() }; },
    watchWhatsAppLeave: mocks.leave,
  };
});

import { AcceptLeadButton } from "./accept-lead-button";

afterEach(() => {
  device.current = "desktop";
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
    // Computador: o contador de 30 s continua; nada é preparado nem aberto no clique.
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.go).not.toHaveBeenCalled();
  });

  it("celular: sem contador, abre o WhatsApp no próprio toque assim que o aceite confirma", async () => {
    device.current = "mobile";
    mocks.go.mockReturnValue(true);
    mocks.leave.mockResolvedValue("opened");
    const url = "https://wa.me/5521997216462?text=Ol%C3%A1";
    mocks.accept.mockResolvedValue({ success: true, whatsappUrl: url });
    render(<AcceptLeadButton leadId="l1">Aceitar lead</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar lead" }));
    // A "janela" é preparada dentro do clique, antes do await (ativação do toque).
    expect(mocks.prepare).toHaveBeenCalledWith("mobile");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
    expect(mocks.go).toHaveBeenCalledWith(url);
    expect(mocks.leave).toHaveBeenCalled();
    expect(mocks.remember).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Lead aceito. Abrindo o WhatsApp do cliente.", expect.anything());
    await Promise.resolve();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("celular: se o app não abriu, avisa a tela do lead para mostrar 'Toque para abrir o WhatsApp'", async () => {
    device.current = "mobile";
    mocks.go.mockReturnValue(true);
    mocks.leave.mockResolvedValue("failed");
    const url = "https://wa.me/5521997216462?text=Ol%C3%A1";
    mocks.accept.mockResolvedValue({ success: true, whatsappUrl: url });
    render(<AcceptLeadButton leadId="l1">Aceitar lead</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar lead" }));
    await waitFor(() => expect(mocks.report).toHaveBeenCalledWith("l1", url));
    expect(mocks.remember).not.toHaveBeenCalled();
  });

  it("celular: se o aceite falhar no servidor (lead já foi de outro), não vai para o WhatsApp nem sai da tela", async () => {
    device.current = "mobile";
    mocks.accept.mockResolvedValue({ success: false, error: "Outro corretor já aceitou." });
    render(<AcceptLeadButton leadId="l1">Aceitar lead</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar lead" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.go).not.toHaveBeenCalled();
    expect(mocks.leave).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
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
