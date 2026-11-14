// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ accept: vi.fn(), push: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn(), fly: vi.fn() }));
const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});
vi.mock("@/components/lite/motion/lead-arc", () => ({ flyLeadArc: mocks.fly }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/features/leads/accept-offer-action", () => ({ acceptLeadOfferAction: mocks.accept }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

import { motionTokens } from "@/components/arc/motion-tokens";
import { readMotion } from "@/components/lite/motion/capture-motion";
import { InterfaceMotionProvider } from "@/components/motion/interface-motion-provider";

import { AcceptLeadButton } from "./accept-lead-button";

function fakeTab() {
  const tab = { closed: false, opener: {} as unknown, close: vi.fn(() => { tab.closed = true; }), location: { href: "about:blank" }, document: { title: "", body: { style: { cssText: "" }, textContent: "" } } };
  return tab;
}

beforeEach(() => {
  motionState.reduce = false;
  mocks.accept.mockReset();
  vi.spyOn(window, "open").mockReturnValue(fakeTab() as unknown as Window);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function checkPath(button: HTMLElement) {
  const path = button.querySelector("svg path");
  expect(path).not.toBeNull();
  return path!;
}

describe("AcceptLeadButton: confirmação no botão", () => {
  for (const appearance of ["shared", "legacy"] as const) {
    it(`${appearance}: "Aceitando…" sem check; o check do LiteSuccess só desenha quando o servidor confirma`, async () => {
      let finish: (value: { success: true }) => void = () => {};
      mocks.accept.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
      render(<AcceptLeadButton appearance={appearance} leadId="l1" arcToLeads>Aceitar e chamar</AcceptLeadButton>);
      fireEvent.click(screen.getByRole("button", { name: "Aceitar e chamar" }));
      // O motion de teste (captureMotion) recria o elemento a cada render: sempre buscar o botão de novo.
      const current = () => screen.getByRole("button");

      await waitFor(() => expect(current().textContent).toContain("Aceitando…"));
      let button = current();
      expect(button.textContent).not.toContain("Lead aceito");
      expect(button.querySelector("svg")).toBeNull();
      expect(button.getAttribute("data-confirmed")).toBeNull();
      expect(mocks.fly).not.toHaveBeenCalled();

      finish({ success: true });
      await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/leads/l1"));
      await waitFor(() => expect(current().getAttribute("data-confirmed")).toBe("true"));
      button = current();
      expect(button.getAttribute("data-state")).toBe("accepted");
      expect(button.textContent).toBe("Lead aceito");
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(mocks.fly).toHaveBeenCalledTimes(1);

      const motion = readMotion(checkPath(button));
      expect(motion.initial).toEqual({ pathLength: 0 });
      const duration = (motion.transition as { duration: number }).duration;
      expect(duration).toBeLessThanOrEqual(0.32);
      expect(duration).toBe(motionTokens.duration.draw);
    });
  }

  it("confirmado não aceita de novo", async () => {
    mocks.accept.mockResolvedValue({ success: true });
    render(<AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton>);
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("data-confirmed")).toBe("true"));
    fireEvent.click(button);
    expect(mocks.accept).toHaveBeenCalledTimes(1);
  });

  it("recusa do servidor não mostra check, mostra a causa e volta como Tentar de novo", async () => {
    mocks.accept.mockResolvedValueOnce({ success: false, error: "Oferta encerrada." });
    render(<AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton>);
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Oferta encerrada"));
    expect(mocks.error).not.toHaveBeenCalled();
    await waitFor(() => expect(button.textContent).toBe("Tentar de novo"), { timeout: 3000 });
    // Só o raio do visual de aceite (decorativo); nenhum check.
    expect(button.querySelector(":not([data-accept-icon]) > svg")).toBeNull();
    expect(button.getAttribute("data-confirmed")).toBeNull();
  });

  it("movimento reduzido: o check já aparece pronto", async () => {
    motionState.reduce = true;
    mocks.accept.mockResolvedValueOnce({ success: true });
    render(<AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton>);
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("data-confirmed")).toBe("true"));
    expect(readMotion(checkPath(button)).initial).toEqual({ pathLength: 1 });
    expect(readMotion(button.querySelector("svg")!).initial).toEqual({ opacity: 0 });
  });

  it("kill-switch de movimento desligado: o check já aparece pronto", async () => {
    mocks.accept.mockResolvedValueOnce({ success: true });
    render(<InterfaceMotionProvider enabled={false}><AcceptLeadButton appearance="shared" leadId="l1">Aceitar e chamar</AcceptLeadButton></InterfaceMotionProvider>);
    const button = screen.getByRole("button", { name: "Aceitar e chamar" });
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute("data-confirmed")).toBe("true"));
    expect(readMotion(checkPath(button)).initial).toEqual({ pathLength: 1 });
    expect(mocks.push).toHaveBeenCalledWith("/leads/l1");
  });
});
