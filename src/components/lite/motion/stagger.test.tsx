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
import { LiteStagger, LiteStaggerItem } from "./stagger";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteStagger", () => {
  it("renders every child, including past the cascade cap", () => {
    const items = Array.from({ length: 12 }, (_, i) => <p key={i}>Linha {i + 1}</p>);
    render(<LiteStagger>{items}</LiteStagger>);
    expect(screen.getAllByText(/^Linha /)).toHaveLength(12);
    expect(screen.getByText("Linha 12")).toBeInTheDocument();
  });

  it("delays each row by 35 ms and stops the delay at the eighth row", () => {
    const items = Array.from({ length: 12 }, (_, i) => <p key={i}>Linha {i + 1}</p>);
    const { container } = render(<LiteStagger>{items}</LiteStagger>);
    const rows = Array.from(container.firstElementChild!.children);
    expect((readMotion(rows[3]!).transition as { delay: number }).delay).toBeCloseTo(0.105);
    expect((readMotion(rows[7]!).transition as { delay: number }).delay).toBeCloseTo(0.245);
    expect((readMotion(rows[8]!).transition as { delay: number }).delay).toBeCloseTo(0.28);
    expect((readMotion(rows[11]!).transition as { delay: number }).delay).toBeCloseTo(0.28);
  });

  it("moves rows 6 px up when motion is on", () => {
    const { container } = render(<LiteStaggerItem index={0}><p>Item</p></LiteStaggerItem>);
    expect(readMotion(container.firstElementChild!).initial).toEqual({ opacity: 0, y: 6 });
  });

  it("has no displacement and no delay with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LiteStaggerItem index={20}><p>Último</p></LiteStaggerItem>);
    const motion = readMotion(container.firstElementChild!);
    expect(displacementOf(motion.initial)).toEqual([]);
    expect((motion.transition as { delay?: number }).delay ?? 0).toBe(0);
  });
});
