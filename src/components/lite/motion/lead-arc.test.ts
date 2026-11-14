// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LEAD_ARC_COOLDOWN_MS, LEAD_ARC_DURATION_MS, canFlyLeadArc, findLeadArcTarget, flyLeadArc, leadArcPoints, resetLeadArcSession } from "./lead-arc";

function rect(x: number, y: number, size = 20) {
  return { left: x, top: y, right: x + size, bottom: y + size, width: size, height: size, x, y, toJSON: () => ({}) } as DOMRect;
}

function place(element: HTMLElement, box: DOMRect) {
  element.getBoundingClientRect = () => box;
  document.body.appendChild(element);
  return element;
}

let reduced = false;
const animate = vi.fn(() => ({ onfinish: null, oncancel: null }) as unknown as Animation);

beforeEach(() => {
  reduced = false;
  resetLeadArcSession();
  animate.mockClear();
  document.documentElement.dataset.interfaceMotion = "on";
  window.matchMedia = ((query: string) => ({ matches: query.includes("reduce") && reduced, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
});

afterEach(() => {
  document.body.innerHTML = "";
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

function scene() {
  const button = place(document.createElement("button"), rect(100, 500, 40));
  const count = document.createElement("span");
  count.setAttribute("data-lite-arc-target", "leads");
  place(count, rect(300, 40));
  return { button, count };
}

describe("canFlyLeadArc", () => {
  it("flies the first time and then at most once every 10 minutes", () => {
    expect(canFlyLeadArc({ now: 0, lastAt: null, motionEnabled: true })).toBe(true);
    expect(canFlyLeadArc({ now: LEAD_ARC_COOLDOWN_MS - 1, lastAt: 0, motionEnabled: true })).toBe(false);
    expect(canFlyLeadArc({ now: LEAD_ARC_COOLDOWN_MS, lastAt: 0, motionEnabled: true })).toBe(true);
  });

  it("never flies with motion off", () => {
    expect(canFlyLeadArc({ now: 0, lastAt: null, motionEnabled: false })).toBe(false);
  });
});

describe("leadArcPoints", () => {
  it("starts and ends on the two centers and rises above both on the way", () => {
    const points = leadArcPoints({ x: 0, y: 400 }, { x: 300, y: 50 });
    expect(points[0]).toEqual({ x: 0, y: 400 });
    expect(points.at(-1)!.x).toBeCloseTo(300);
    expect(points.at(-1)!.y).toBeCloseTo(50);
    expect(Math.min(...points.map((point) => point.y))).toBeLessThan(50);
  });
});

describe("flyLeadArc", () => {
  it("flies a hidden dot from the button to the Leads count within 400ms", () => {
    const { button } = scene();
    expect(flyLeadArc(button, { now: 1_000 })).toBe(true);
    expect(animate).toHaveBeenCalledTimes(1);
    const [, options] = animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(options.duration).toBe(LEAD_ARC_DURATION_MS);
    expect(LEAD_ARC_DURATION_MS).toBeLessThanOrEqual(400);
    expect(document.querySelector("[data-lite-arc-dot]")).toHaveAttribute("aria-hidden", "true");
  });

  it("is limited to one flight every 10 minutes in the session", () => {
    const { button } = scene();
    expect(flyLeadArc(button, { now: 0 })).toBe(true);
    expect(flyLeadArc(button, { now: LEAD_ARC_COOLDOWN_MS - 1 })).toBe(false);
    expect(flyLeadArc(button, { now: LEAD_ARC_COOLDOWN_MS })).toBe(true);
    expect(animate).toHaveBeenCalledTimes(2);
  });

  it("does nothing with reduced motion, the kill-switch or the app motion off", () => {
    const { button } = scene();
    reduced = true;
    expect(flyLeadArc(button, { now: 0 })).toBe(false);
    reduced = false;
    document.documentElement.dataset.interfaceMotion = "off";
    expect(flyLeadArc(button, { now: 0 })).toBe(false);
    document.documentElement.dataset.interfaceMotion = "on";
    expect(flyLeadArc(button, { now: 0, motionEnabled: false })).toBe(false);
    expect(animate).not.toHaveBeenCalled();
    // Uma tentativa recusada não gasta a vez da sessão.
    expect(flyLeadArc(button, { now: 0 })).toBe(true);
  });

  it("does nothing when the Leads count is off screen or missing", () => {
    const { button, count } = scene();
    count.getBoundingClientRect = () => rect(300, window.innerHeight + 50);
    expect(findLeadArcTarget()).toBeNull();
    expect(flyLeadArc(button, { now: 0 })).toBe(false);
    count.remove();
    expect(flyLeadArc(button, { now: 0 })).toBe(false);
    expect(animate).not.toHaveBeenCalled();
  });
});
