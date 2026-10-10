// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  const components = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const motion = new Proxy({} as typeof actual.motion, {
    get(_target, element: string) {
      if (!components.has(element)) {
        // eslint-disable-next-line react/display-name -- test-only motion stand-in
        components.set(element, React.forwardRef<HTMLElement, Record<string, unknown>>((props, ref) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars -- motion props dropped on purpose
          const { animate, initial: _initial, exit: _exit, transition: _transition, layout: _layout, onAnimationComplete: _onAnimationComplete, style, ...rest } = props;
          const animated = animate && typeof animate === "object" ? animate as Record<string, unknown> : {};
          const inline = Object.fromEntries(Object.entries(animated).filter(([key]) => ["left", "top", "width", "height", "borderRadius", "opacity"].includes(key)));
          return element === "rect"
            ? React.createElement(element, { ...rest, ...animated, ref, style: style as React.CSSProperties })
            : React.createElement(element, { ...rest, ref, style: { ...(style as React.CSSProperties), ...inline } });
        }));
      }
      return components.get(element);
    },
  });
  return { ...actual, motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>, useReducedMotion: () => true };
});

import { LiteTour, startLiteTour } from "./lite-tour";
import { TOUR_STEPS } from "./tour-steps";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.reject(new Error("no audio")));
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  document.querySelector('[data-tour="home-header"]')?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/dashboard");
  vi.useRealTimers();
});

describe("Lite tour QA", () => {
  it("keeps the visible and narrated copy free of em dashes", () => {
    const copy = TOUR_STEPS.flatMap(({ title, body, narration }) => [title, body, narration]).join("\n");
    expect(copy).not.toContain("\u2014");
  });

  it("returns to the previous step with Voltar", async () => {
    render(<LiteTour />);
    await act(async () => { startLiteTour(); });

    fireEvent.click(screen.getByRole("button", { name: /^Come/ }));
    expect(await screen.findByRole("dialog", { name: TOUR_STEPS[10]!.title })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByRole("dialog", { name: TOUR_STEPS[0]!.title })).toBeTruthy();
  });

  it("starts from ?tour=1 and removes only the tour parameter", async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/dashboard?tour=1");
    render(<LiteTour />);

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });

    expect(window.location.search).toBe("");
    expect(screen.getByRole("dialog", { name: TOUR_STEPS[0]!.title })).toBeTruthy();
  });

  it("shows and positions the spotlight ring and card when its target exists", async () => {
    const target = document.createElement("header");
    target.dataset.tour = "home-header";
    target.scrollIntoView = vi.fn();
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      x: 100, y: 120, left: 100, top: 120, right: 300, bottom: 170, width: 200, height: 50,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.append(target);
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    render(<LiteTour />);
    await act(async () => { startLiteTour(); });
    fireEvent.click(screen.getByRole("button", { name: /^Come/ }));

    const dialog = await screen.findByRole("dialog", { name: TOUR_STEPS[1]!.title });
    await waitFor(() => expect(dialog.style.top).toBe("192px"));
    expect(dialog.style.left).toBe("20px");
    expect(dialog.style.width).toBe("360px");
    expect(document.querySelector('[aria-hidden="true"][class*="ring"]')).toBeTruthy();

    target.remove();
  });

  it("awards 10 XP for a wrong challenge answer and shows the Quase feedback", async () => {
    render(<LiteTour />);
    await act(async () => { startLiteTour(); });
    fireEvent.click(screen.getByRole("button", { name: /^Come/ }));
    expect(await screen.findByRole("dialog", { name: TOUR_STEPS[10]!.title })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Esperar ela mandar mensagem/ }));

    expect(screen.getByRole("status").textContent).toContain("Quase");
    expect(screen.getByText("20")).toBeTruthy();
  });
});
