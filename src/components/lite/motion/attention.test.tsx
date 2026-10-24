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
import { LiteAttention } from "./attention";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteAttention", () => {
  it("keeps the child and adds no pulse without a pulse key", () => {
    const { container } = render(<LiteAttention><span>Sino</span></LiteAttention>);
    expect(screen.getByText("Sino")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("adds one decorative pulse that starts at 0.5 opacity and grows to 1.04 over 0.6 s", () => {
    const { container } = render(<LiteAttention pulseKey={1}><span>Sino</span></LiteAttention>);
    const pulse = container.querySelector('[aria-hidden="true"]')!;
    const motion = readMotion(pulse);
    expect(motion.initial).toEqual({ opacity: 0.5, scale: 1 });
    expect(motion.animate).toEqual({ opacity: 0, scale: 1.04 });
    expect((motion.transition as { duration: number }).duration).toBeCloseTo(0.6);
    expect((motion.transition as { repeat?: number }).repeat).toBeUndefined();
  });

  it("only fades with reduced motion: no growth and a short fade", () => {
    motionState.reduce = true;
    const { container } = render(<LiteAttention pulseKey="novo"><span>Sino</span></LiteAttention>);
    const motion = readMotion(container.querySelector('[aria-hidden="true"]')!);
    expect(motion.animate).toEqual({ opacity: 0, scale: 1 });
    expect(displacementOf(motion.animate)).toEqual([]);
    expect((motion.transition as { duration: number }).duration).toBeCloseTo(0.12);
  });
});
