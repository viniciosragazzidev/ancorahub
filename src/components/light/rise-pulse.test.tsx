// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

import { readMotion } from "@/components/lite/motion/capture-motion";
import { RisePulse, useRisePulseKey } from "./rise-pulse";

/** Como a aba usa: o hook fica no pai (sempre montado) e o selo só existe com número. */
function Badge({ count }: { count: number }) {
  const pulseKey = useRisePulseKey(count);
  return <div>{count > 0 ? <RisePulse pulseKey={pulseKey}><span>{count}</span></RisePulse> : null}</div>;
}

const ring = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]');

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("RisePulse", () => {
  it("does not pulse on mount", () => {
    const { container } = render(<Badge count={3} />);
    expect(ring(container)).toBeNull();
  });

  it("pulses once, within 300 ms and without repeat, when the count goes up", () => {
    const { container, rerender } = render(<Badge count={3} />);
    rerender(<Badge count={4} />);
    const transition = readMotion(ring(container)!).transition as { duration: number; repeat?: number };
    expect(transition.duration).toBeLessThanOrEqual(0.3);
    expect(transition.repeat).toBeUndefined();
  });

  it("does not pulse when the count goes down", () => {
    const { container, rerender } = render(<Badge count={3} />);
    rerender(<Badge count={2} />);
    expect(ring(container)).toBeNull();
  });

  it("pulses when the badge appears, going from zero to one", () => {
    const { container, rerender } = render(<Badge count={0} />);
    rerender(<Badge count={1} />);
    expect(ring(container)).not.toBeNull();
  });

  it("moves nothing with reduced motion: no ring at all", () => {
    motionState.reduce = true;
    const { container, rerender } = render(<Badge count={1} />);
    rerender(<Badge count={5} />);
    expect(ring(container)).toBeNull();
  });
});
