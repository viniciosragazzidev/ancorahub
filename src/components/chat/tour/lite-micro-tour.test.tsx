// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { LiteMicroTour, startLiteMicroTour } from "./lite-tour";
import { getMicroTourForPath, MICRO_TOURS } from "./tour-steps";

vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { HelpSheet } from "@/features/assist/components/help-sheet";

const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.dataset.leadOffer = "0";
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new Error("no audio")));
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 40, y: 50, left: 40, top: 50, right: 180, bottom: 90, width: 140, height: 40, toJSON: () => ({}) });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

describe("Lite micro tours", () => {
  it("has short screen-specific steps for all five broker Lite destinations", () => {
    const routes = ["/jornada", "/minha-fila", "/leads/lead-1", "/plantoes", "/settings"];
    for (const route of routes) {
      const microTour = getMicroTourForPath(route);
      expect(microTour, route).not.toBeNull();
      expect(microTour!.steps.length, route).toBeGreaterThanOrEqual(2);
      expect(microTour!.steps.length, route).toBeLessThanOrEqual(4);
      expect(microTour!.steps.every((step) => step.kind === "spotlight" && step.target), route).toBe(true);
      expect(microTour!.steps.some((step) => `${step.title} ${step.body}`.includes("—")), route).toBe(false);
    }
    expect(getMicroTourForPath("/leads")).toBeNull();
    expect(getMicroTourForPath("/leads/distribuicao")).toBeNull();
    expect(Object.keys(MICRO_TOURS)).toHaveLength(5);
  });

  it("starts automatically on first visit and can be started again manually", async () => {
    render(<>
      <button data-tour="micro-journey-summary">Resumo</button>
      <button data-tour="micro-journey-missions">Missões</button>
      <button data-tour="micro-journey-ledger">Extrato</button>
      <LiteMicroTour pathname="/jornada" />
    </>);
    expect(await screen.findByRole("dialog", { name: "Seu resumo da semana" }, { timeout: 2000 })).toBeTruthy();
    expect(screen.getByText("Passo 1 de 3")).toBeTruthy();
    expect(screen.queryByText("XP", { exact: true })).toBeNull();
    await act(async () => { startLiteMicroTour("/jornada"); });
    expect(screen.getByRole("dialog", { name: "Seu resumo da semana" })).toBeTruthy();
  });

  it("waits until an open lead offer closes before starting", async () => {
    document.documentElement.dataset.leadOffer = "1";
    render(<>
      <button data-tour="micro-journey-summary">Resumo</button>
      <button data-tour="micro-journey-missions">Missões</button>
      <button data-tour="micro-journey-ledger">Extrato</button>
      <LiteMicroTour pathname="/jornada" />
    </>);
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 520)); });
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      document.documentElement.dataset.leadOffer = "0";
      await new Promise((resolve) => window.setTimeout(resolve, 520));
    });
    expect(await screen.findByRole("dialog", { name: "Seu resumo da semana" }, { timeout: 1000 })).toBeTruthy();
  });

  it("closes the tour if a lead offer arrives while it is open", async () => {
    render(<>
      <button data-tour="micro-journey-summary">Resumo</button>
      <LiteMicroTour pathname="/jornada" />
    </>);
    expect(await screen.findByRole("dialog", { name: "Seu resumo da semana" }, { timeout: 2000 })).toBeTruthy();
    await act(async () => { document.documentElement.dataset.leadOffer = "1"; });
    expect(await screen.findByRole("dialog").catch(() => null)).toBeNull();
  });

  it("offers Me mostra only on a supported screen and starts that screen's tour", async () => {
    const start = vi.fn();
    window.addEventListener("ancora:start-lite-micro-tour:jornada", start);
    const { rerender } = render(<HelpSheet pathname="/jornada" open onOpenChange={vi.fn()} onSearch={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Me mostra" });
    fireEvent.click(button);
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 310)); });
    expect(start).toHaveBeenCalledOnce();
    rerender(<HelpSheet pathname="/clientes" open onOpenChange={vi.fn()} onSearch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Me mostra" })).toBeNull();
    window.removeEventListener("ancora:start-lite-micro-tour:jornada", start);
  });
});
