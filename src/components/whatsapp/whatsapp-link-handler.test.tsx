// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsAppLinkHandler } from "./whatsapp-link-handler";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WhatsAppLinkHandler", () => {
  it("opens any wa.me link straight in WhatsApp Web", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<><WhatsAppLinkHandler /><a href="https://wa.me/21997216462" target="_blank" rel="noreferrer">WhatsApp</a></>);
    const notPrevented = fireEvent.click(screen.getByRole("link", { name: "WhatsApp" }));
    expect(notPrevented).toBe(false);
    expect(open).toHaveBeenCalledWith("https://web.whatsapp.com/send?phone=5521997216462", "whatsapp_web");
  });

  it("leaves other links and clicks already handled alone", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<><WhatsAppLinkHandler /><a href="/leads/1">Ficha</a><a href="https://wa.me/21997216462" onClick={(event) => event.preventDefault()}>Dialog</a></>);
    fireEvent.click(screen.getByRole("link", { name: "Ficha" }));
    fireEvent.click(screen.getByRole("link", { name: "Dialog" }));
    expect(open).not.toHaveBeenCalled();
  });
});
