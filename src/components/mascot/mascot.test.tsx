// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ enabled: true }));
const animateCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock("@/components/motion/interface-motion-provider", () => ({ useInterfaceMotionEnabled: () => motionState.enabled }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const scope = { current: null as Element | null, animations: [] };
  const animate = (...args: unknown[]) => { animateCalls.push(args); return { stop: () => {} }; };
  return { ...actual, useAnimate: () => [new Proxy(scope, { set: (t, k, v) => { (t as Record<string | symbol, unknown>)[k] = v; return true; } }), animate] };
});
// O runtime da Rive não carrega no jsdom: o teste só confere quando ele é pedido.
const riveRendered = vi.hoisted(() => vi.fn());
vi.mock("next/dynamic", () => ({ default: () => (props: unknown) => { riveRendered(props); return null; } }));

import { Mascot } from "./mascot";
import { MASCOT_STATES, MASCOT_STATE_ART, mascotStateIndex } from "./mascot-config";
import { mascotMotion } from "./mascot-motion";

beforeEach(() => {
  motionState.enabled = true;
  riveRendered.mockClear();
  animateCalls.length = 0;
  document.documentElement.removeAttribute("data-reduce-motion");
});
afterEach(cleanup);

describe("Mascot", () => {
  it("keeps both local poses loaded in a fixed box and shows the one for each state", () => {
    for (const state of MASCOT_STATES) {
      const { container, unmount } = render(<Mascot state={state} size={200} />);
      const box = container.firstElementChild as HTMLElement;
      expect(box.style.height).toBe("200px");
      expect(box.style.width).toBe("128px");
      expect(box.getAttribute("data-mascot-renderer")).toBe("fallback");
      expect(container.querySelectorAll("img")).toHaveLength(2);
      const visible = container.querySelector('img[data-visible="true"]')!;
      expect(visible.getAttribute("data-art")).toBe(MASCOT_STATE_ART[state]);
      expect(visible.getAttribute("src")).toMatch(/^\/mascote\/(repouso|positivo)\.webp$/);
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

  it("plays the state's movement and replays it when playKey changes", () => {
    const { rerender } = render(<Mascot state="lead_accepted" playKey={1} />);
    expect(animateCalls.at(-1)![1]).toEqual(mascotMotion("lead_accepted", true).animate);
    const before = animateCalls.length;
    rerender(<Mascot state="lead_accepted" playKey={2} />);
    expect(animateCalls.length).toBeGreaterThan(before);
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

  it("plays the local pre-rendered clip only for its states, in light theme, with motion on", () => {
    const { container } = render(<Mascot state="lead_accepted" />);
    const clip = container.querySelector("video")!;
    expect(clip.getAttribute("src")).toBe("/mascote/lead-accepted.mp4");
    expect(clip.muted).toBe(true);
    expect(clip.style.mixBlendMode).toBe("multiply");
    cleanup();
    expect(render(<Mascot state="idle" />).container.querySelector("video")).toBeNull();
    cleanup();
    motionState.enabled = false;
    expect(render(<Mascot state="lead_accepted" />).container.querySelector("video")).toBeNull();
    cleanup();
    motionState.enabled = true;
    document.documentElement.classList.add("dark");
    expect(render(<Mascot state="lead_accepted" />).container.querySelector("video")).toBeNull();
    document.documentElement.classList.remove("dark");
  });

  it("maps states to the Rive number input in a stable order", () => {
    expect(MASCOT_STATES.map(mascotStateIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("mascotMotion", () => {
  it("stays still with motion off, in every state", () => {
    for (const state of MASCOT_STATES) {
      expect(mascotMotion(state, false)).toMatchObject({ initial: false, transition: { duration: 0 } });
    }
  });

  it("hops once on lead_accepted, shakes on error and only loading repeats", () => {
    expect((mascotMotion("lead_accepted", true).animate as { y: number[] }).y).toEqual([0, 1, -8, 0]);
    expect((mascotMotion("error", true).animate as { x: number[] }).x).toEqual([0, -4, 4, -4, 4, 0]);
    for (const state of MASCOT_STATES) {
      const repeat = (mascotMotion(state, true).transition as { repeat?: number }).repeat;
      expect(repeat === Infinity).toBe(state === "loading");
    }
  });

  it("enters from below on welcome", () => {
    expect(mascotMotion("welcome", true).initial).toMatchObject({ opacity: 0, y: 12 });
  });
});
