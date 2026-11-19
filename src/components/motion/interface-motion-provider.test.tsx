// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterfaceMotionProvider, useInterfaceMotionEnabled, useMotionAllowed } from "./interface-motion-provider";

function Probe() {
  const enabled = useInterfaceMotionEnabled();
  return <output>{enabled ? "motion-on" : "motion-off"}</output>;
}

function AllowedProbe() {
  return <output>{useMotionAllowed() ? "allowed" : "blocked"}</output>;
}

describe("shared interface motion governance", () => {
  let reduced = false;
  const listeners = new Set<() => void>();

  beforeEach(() => {
    reduced = false;
    vi.stubGlobal("matchMedia", () => ({
      matches: reduced,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }));
  });
  afterEach(() => {
    cleanup();
    listeners.clear();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.interfaceMotion;
    delete document.documentElement.dataset.reduceMotion;
  });

  it("keeps CSS portals and React controls in sync when the flag changes", () => {
    const { rerender } = render(
      <InterfaceMotionProvider enabled>
        <Probe />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByText("motion-on")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-interface-motion", "on");
    rerender(
      <InterfaceMotionProvider enabled={false}>
        <Probe />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByText("motion-off")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-interface-motion", "off");
  });

  it("reacts to reduced motion without a reload and restores the approved mode", () => {
    render(
      <InterfaceMotionProvider enabled>
        <Probe />
      </InterfaceMotionProvider>,
    );
    act(() => {
      reduced = true;
      listeners.forEach((notify) => notify());
    });
    expect(screen.getByText("motion-off")).toBeInTheDocument();
    act(() => {
      reduced = false;
      listeners.forEach((notify) => notify());
    });
    expect(screen.getByText("motion-on")).toBeInTheDocument();
  });

  it("loads the public flag and refreshes it on returning to the window", async () => {
    const fetchPreference = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ enabled: true }))
      .mockResolvedValueOnce(Response.json({ enabled: false }));
    vi.stubGlobal("fetch", fetchPreference);
    render(
      <InterfaceMotionProvider>
        <Probe />
      </InterfaceMotionProvider>,
    );
    // Começa ligado (padrão da chave) e só desliga quando a leitura responde desligada.
    expect(screen.getByText("motion-on")).toBeInTheDocument();
    await waitFor(() => expect(fetchPreference).toHaveBeenCalledOnce());
    expect(screen.getByText("motion-on")).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event("focus")));
    await screen.findByText("motion-off");
    expect(fetchPreference).toHaveBeenCalledWith(
      "/api/public/interface-motion",
      expect.objectContaining({ cache: "no-store", credentials: "omit" }),
    );
  });

  it("leaves the application usable and static when the preference is unavailable", async () => {
    const fetchPreference = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchPreference);
    render(
      <InterfaceMotionProvider>
        <Probe />
        <button>Continuar</button>
      </InterfaceMotionProvider>,
    );
    await waitFor(() => expect(fetchPreference).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    expect(screen.getByText("motion-off")).toBeInTheDocument();
  });

  it("\"Menos animação\" do app desliga o movimento e marca o <html>", async () => {
    render(
      <InterfaceMotionProvider enabled>
        <Probe />
        <AllowedProbe />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByText("allowed")).toBeInTheDocument();
    act(() => {
      document.documentElement.dataset.reduceMotion = "1";
    });
    await screen.findByText("blocked");
    expect(screen.getByText("motion-off")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-interface-motion", "off");
  });

  it("useMotionAllowed respeita o kill switch e o sistema", () => {
    const { rerender } = render(
      <InterfaceMotionProvider enabled={false}>
        <AllowedProbe />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByText("blocked")).toBeInTheDocument();
    rerender(
      <InterfaceMotionProvider enabled>
        <AllowedProbe />
      </InterfaceMotionProvider>,
    );
    expect(screen.getByText("allowed")).toBeInTheDocument();
    act(() => {
      reduced = true;
      listeners.forEach((notify) => notify());
    });
    expect(screen.getByText("blocked")).toBeInTheDocument();
  });
});
