// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn() }));
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
});
