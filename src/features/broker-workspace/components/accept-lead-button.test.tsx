// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), fly: vi.fn() }));
vi.mock("@/components/lite/motion/lead-arc", () => ({ flyLeadArc: mocks.fly }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: mocks.accept }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { AcceptLeadButton } from "./accept-lead-button";

function fakeTab() {
  const tab = { closed: false, opener: {} as unknown, close: vi.fn(() => { tab.closed = true; }), location: { href: "about:blank" }, document: { title: "", body: { style: { cssText: "" }, textContent: "" } } };
  return tab;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("AcceptLeadButton", () => {
  it("shared: impede envio duplicado e mantém erro junto da ação para tentar novamente", async () => {
    vi.spyOn(window, "open").mockReturnValue(fakeTab() as unknown as Window);
    let finish: (value: { success: false; error: string }) => void = () => {};
    mocks.accept.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton>);
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
    finish({ success: false, error: "Oferta encerrada." });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Oferta encerrada"));
    expect(mocks.push).not.toHaveBeenCalled();
    mocks.accept.mockResolvedValueOnce({ success: true });
    fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar" }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(2));
  });

  it("accepts and opens the client's WhatsApp Web in the same tap", async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    mocks.accept.mockResolvedValue({ success: true, whatsappUrl: "https://web.whatsapp.com/send?phone=5521997216462&text=Ol%C3%A1" });
    render(<AcceptLeadButton leadId="l1">Aceitar e chamar no WhatsApp</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar no WhatsApp" }));
    // The tab opens inside the click, before the accept resolves (popup blockers).
    expect(open).toHaveBeenCalledWith("", "whatsapp_web");
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
    expect(tab.location.href).toBe("https://web.whatsapp.com/send?phone=5521997216462&text=Ol%C3%A1");
    expect(mocks.success).toHaveBeenCalledWith("Lead aceito. Abrindo o WhatsApp do cliente.", expect.anything());
  });

  it("closes the tab and explains when the accept fails", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    mocks.accept.mockResolvedValue({ success: false, error: "Este lead já foi assumido por outro corretor." });
    render(<AcceptLeadButton leadId="l1">Aceitar e chamar no WhatsApp</AcceptLeadButton>);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar no WhatsApp" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(tab.close).toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("mostra o lead como aceito na hora e volta ao rótulo original se o servidor recusar", async () => {
    vi.spyOn(window, "open").mockReturnValue(fakeTab() as unknown as Window);
    let finish: (value: { success: false; error: string }) => void = () => {};
    mocks.accept.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton>);
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    await waitFor(() => expect(button.textContent).toContain("Lead aceito"));
    expect(button.getAttribute("data-state")).toBe("accepted");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    finish({ success: false, error: "Este lead já foi assumido por outro corretor." });
    await waitFor(() => expect(button.textContent).toBe("Aceitar e chamar"));
    expect(button.getAttribute("data-state")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("Este lead já foi assumido por outro corretor.");
  });
  it("arco até Leads: só com arcToLeads e só depois do aceite confirmado", async () => {
    vi.spyOn(window, "open").mockReturnValue(fakeTab() as unknown as Window);
    mocks.accept.mockResolvedValueOnce({ success: false, error: "Oferta encerrada." });
    render(<AcceptLeadButton appearance="shared" leadId="l1" arcToLeads>Aceitar e chamar</AcceptLeadButton>);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.fly).not.toHaveBeenCalled();

    mocks.accept.mockResolvedValueOnce({ success: true });
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
    expect(mocks.fly).toHaveBeenCalledTimes(1);
    expect(mocks.fly).toHaveBeenCalledWith(button, expect.objectContaining({ motionEnabled: expect.any(Boolean) }));
  });

  it("sem arcToLeads o aceite nunca dispara o arco", async () => {
    vi.spyOn(window, "open").mockReturnValue(fakeTab() as unknown as Window);
    mocks.accept.mockResolvedValueOnce({ success: true });
    render(<AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton>);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
    expect(mocks.fly).not.toHaveBeenCalled();
  });
});

