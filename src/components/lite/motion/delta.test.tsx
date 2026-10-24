// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("./capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

import { displacementOf, readMotion } from "./capture-motion";
import { LiteDelta } from "./delta";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteDelta", () => {
  it("shows a positive variation with a plus sign and the up tone", () => {
    render(<LiteDelta value={12} />);
    expect(screen.getByText("+12%")).toHaveAttribute("data-tone", "up");
  });

  it("shows a negative variation with the down tone and a flat one without sign", () => {
    const { rerender } = render(<LiteDelta value={-5} />);
    expect(screen.getByText("-5%")).toHaveAttribute("data-tone", "down");
    rerender(<LiteDelta value={0} />);
    expect(screen.getByText("0%")).toHaveAttribute("data-tone", "flat");
  });

  it("enters 4 px below, 80 ms after the number, when motion is on", () => {
    render(<LiteDelta value={3} />);
    const pill = screen.getByText("+3%");
    expect(readMotion(pill).initial).toEqual({ opacity: 0, y: 4 });
    expect((readMotion(pill).transition as { delay: number }).delay).toBeCloseTo(0.08);
  });

  it("has no displacement and no delay with reduced motion", () => {
    motionState.reduce = true;
    render(<LiteDelta value={3} />);
    const motion = readMotion(screen.getByText("+3%"));
    expect(displacementOf(motion.initial)).toEqual([]);
    expect((motion.transition as { delay?: number }).delay ?? 0).toBe(0);
  });
});
