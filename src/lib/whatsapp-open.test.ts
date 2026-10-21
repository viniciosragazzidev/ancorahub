// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { openWhatsApp, prepareWhatsAppWindow } from "./whatsapp-open";

function fakeTab(href = "about:blank") {
  const tab = {
    closed: false,
    opener: {} as unknown,
    close: vi.fn(() => { tab.closed = true; }),
    location: { href },
    document: { title: "", body: { style: { cssText: "" }, textContent: "" } },
  };
  return tab;
}

afterEach(() => vi.restoreAllMocks());

describe("openWhatsApp", () => {
  it("opens WhatsApp Web in the named tab on the computer", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    expect(openWhatsApp("https://wa.me/21997216462?text=Oi", "desktop")).toBe(true);
    expect(open).toHaveBeenCalledWith("https://web.whatsapp.com/send?phone=5521997216462&text=Oi", "whatsapp_web");
  });

  it("does nothing for a link that is not WhatsApp", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    expect(openWhatsApp("https://example.com", "desktop")).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});

describe("prepareWhatsAppWindow", () => {
  it("opens the tab inside the click and sends it to the chat after the accept", () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const pending = prepareWhatsAppWindow("desktop");
    expect(open).toHaveBeenCalledWith("", "whatsapp_web");
    expect(tab.document.body.textContent).toBe("Abrindo o WhatsApp Web...");
    expect(pending.go("https://web.whatsapp.com/send?phone=5521997216462")).toBe(true);
    expect(tab.location.href).toBe("https://web.whatsapp.com/send?phone=5521997216462");
    expect(tab.opener).toBeNull();
  });

  it("closes the blank tab when the accept fails", () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    prepareWhatsAppWindow("desktop").cancel();
    expect(tab.close).toHaveBeenCalled();
  });

  it("never closes a WhatsApp tab already in use", () => {
    const tab = fakeTab("https://web.whatsapp.com/");
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    prepareWhatsAppWindow("desktop").cancel();
    expect(tab.close).not.toHaveBeenCalled();
  });

  it("falls back to a new tab when the popup was blocked", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const pending = prepareWhatsAppWindow("desktop");
    expect(pending.go("https://wa.me/21997216462")).toBe(true);
    expect(open).toHaveBeenLastCalledWith("https://web.whatsapp.com/send?phone=5521997216462", "whatsapp_web");
  });

  it("opens no tab on the phone", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    prepareWhatsAppWindow("mobile").cancel();
    expect(open).not.toHaveBeenCalled();
  });
});
