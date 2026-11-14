// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ enabled: true }));
vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => motionState.enabled }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion() };
});
// O runtime da Rive não carrega no jsdom: o teste só confere quando ele é pedido.
const riveRendered = vi.hoisted(() => vi.fn());
vi.mock("next/dynamic", () => ({ default: () => (props: unknown) => { riveRendered(props); return null; } }));

import { readMotion } from "@/components/lite/motion/capture-motion";

import { Mascot } from "./mascot";
import { MASCOT_STATES, mascotStateIndex } from "./mascot-config";

beforeEach(() => {
  motionState.enabled = true;
  riveRendered.mockClear();
  document.documentElement.removeAttribute("data-reduce-motion");
});
afterEach(cleanup);

describe("Mascot", () => {
  it("uses the local fallback art and a fixed box for every state", () => {
    for (const state of MASCOT_STATES) {
      const { container, unmount } = render(<Mascot state={state} size={200} />);
      const box = container.firstElementChild as HTMLElement;
      expect(box.style.height).toBe("200px");
      expect(box.style.width).toBe("124px");
      expect(box.getAttribute("data-mascot-renderer")).toBe("fallback");
      expect(container.querySelector("img")!.getAttribute("src")).toMatch(/^\/mascote\/(repouso|positivo)\.webp$/);
      unmount();
    }
  });

  it("names what the mascot is doing, unless decorative", () => {
    render(<Mascot state="lead_accepted" />);
    expect(screen.getByRole("img", { name: "Mascote da Âncora Saúde fazendo sinal de positivo" })).toBeTruthy();
    cleanup();
    const { container } = render(<Mascot state="lead_accepted" decorative />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("hops on lead_accepted and stays still with motion off", () => {
    const { container } = render(<Mascot state="lead_accepted" />);
    expect((readMotion(container.querySelector("img")!).animate as { y: number[] }).y).toEqual([0, 1, -8, 0]);
    cleanup();
    motionState.enabled = false;
    const still = render(<Mascot state="lead_accepted" />);
    expect(readMotion(still.container.querySelector("img")!).animate).toMatchObject({ y: 0, x: 0 });
  });

  it("stays still when the device asked for less motion", () => {
    document.documentElement.dataset.reduceMotion = "1";
    const { container } = render(<Mascot state="welcome" />);
    expect(readMotion(container.querySelector("img")!).initial).toBe(false);
  });

  it("asks for the Rive rig only when a .riv exists and motion is on", () => {
    render(<Mascot state="success" />);
    expect(riveRendered).not.toHaveBeenCalled();
    cleanup();
    render(<Mascot state="success" riveSrc="/mascote/mascote.riv" />);
    expect(riveRendered).toHaveBeenCalledWith(expect.objectContaining({ src: "/mascote/mascote.riv", state: "success" }));
    cleanup();
    riveRendered.mockClear();
    motionState.enabled = false;
    render(<Mascot state="success" riveSrc="/mascote/mascote.riv" />);
    expect(riveRendered).not.toHaveBeenCalled();
  });

  it("maps states to the Rive number input in a stable order", () => {
    expect(MASCOT_STATES.map(mascotStateIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
