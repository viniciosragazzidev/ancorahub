// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), fly: vi.fn() }));
const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});
vi.mock("@/components/lite/motion/lead-arc", () => ({ flyLeadArc: mocks.fly }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: mocks.accept }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";

import { AcceptLeadButton } from "./accept-lead-button";
import { acceptLeadButtonClass } from "./accept-lead-style";

// Classes do botão preto antigo: fundo da marca (--primary), do --accent ou do --foreground.
const BLACK_CLASSES = /(^|\s)(bg-primary|bg-\(--primary\)|bg-\(--accent\)|bg-foreground|bg-\(--foreground\))(\s|$)/;

beforeEach(() => {
  motionState.reduce = false;
  mocks.accept.mockReset();
  vi.spyOn(window, "open").mockReturnValue({ closed: false, opener: {}, close: vi.fn(), location: { href: "about:blank" }, document: { title: "", body: { style: { cssText: "" }, textContent: "" } } } as unknown as Window);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("AcceptLeadButton: visual verde com o raio", () => {
  it.each(["legacy", "shared"] as const)("%s: rótulo, ícone e a classe compartilhada, sem classe preta", (appearance) => {
    render(<AcceptLeadButton appearance={appearance} leadId="l1" className="extra">Aceitar lead</AcceptLeadButton>);
    const button = screen.getByRole("button", { name: "Aceitar lead" });
    expect(button.textContent).toBe("Aceitar lead");
    const icon = button.querySelector("[data-accept-icon]");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.querySelector("svg")).not.toBeNull();
    expect(acceptLeadButtonClass).toBeTruthy();
    expect(button.className).toContain(acceptLeadButtonClass);
    expect(button.className).toContain("extra");
    expect(button.className).not.toMatch(BLACK_CLASSES);
  });

  it("sem oferta pendente não tem anel nem loop", () => {
    render(<InterfaceMotionProvider enabled><AcceptLeadButton leadId="l1">Aceitar lead</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Aceitar lead" });
    expect(button.hasAttribute("data-offer-pending")).toBe(false);
    expect(button.hasAttribute("data-offer-loop")).toBe(false);
  });
});

describe("AcceptLeadButton: oferta pendente", () => {
  it("mostra o texto 'Oferta pendente' e liga o loop com movimento ligado", () => {
    render(<InterfaceMotionProvider enabled><AcceptLeadButton leadId="l1" offerPending>Aceitar lead</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Oferta pendente: Aceitar lead" });
    expect(button.getAttribute("data-offer-pending")).toBe("true");
    expect(button.getAttribute("data-offer-loop")).toBe("on");
  });

  it("movimento reduzido: loop desligado, mas o anel e o texto de pendente ficam", () => {
    motionState.reduce = true;
    render(<InterfaceMotionProvider enabled><AcceptLeadButton leadId="l1" offerPending>Aceitar lead</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Oferta pendente: Aceitar lead" });
    expect(button.getAttribute("data-offer-pending")).toBe("true");
    expect(button.getAttribute("data-offer-loop")).toBe("off");
  });

  it("kill-switch (movimento da interface desligado): loop desligado, indicador mantido", () => {
    render(<InterfaceMotionProvider enabled={false}><AcceptLeadButton appearance="shared" leadId="l1" offerPending>Aceitar lead</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Oferta pendente: Aceitar lead" });
    expect(button.getAttribute("data-offer-pending")).toBe("true");
    expect(button.getAttribute("data-offer-loop")).toBe("off");
  });

  it("oferta encerrada (desligado): sem pendente nem loop", () => {
    render(<InterfaceMotionProvider enabled><AcceptLeadButton leadId="l1" offerPending disabled>Oferta encerrada</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Oferta encerrada" });
    expect(button.hasAttribute("data-offer-pending")).toBe(false);
    expect(button.hasAttribute("data-offer-loop")).toBe(false);
  });

  it("o loop para assim que o lead é aceito", async () => {
    let finish: (value: { success: true }) => void = () => {};
    mocks.accept.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<InterfaceMotionProvider enabled><AcceptLeadButton leadId="l1" offerPending>Aceitar lead</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Oferta pendente: Aceitar lead" });
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("data-state")).toBe("accepted"));
    expect(button.hasAttribute("data-offer-loop")).toBe(false);
    expect(button.querySelector("[data-accept-icon]")).toBeNull();
    finish({ success: true });
    await waitFor(() => expect(button.getAttribute("data-confirmed")).toBe("true"));
    expect(button.hasAttribute("data-offer-pending")).toBe(false);
  });
});
