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

  it("delays each row by 35 ms, with at most eight distinct delays", () => {
    const items = Array.from({ length: 12 }, (_, i) => <p key={i}>Linha {i + 1}</p>);
    const { container } = render(<LiteStagger>{items}</LiteStagger>);
    const rows = Array.from(container.firstElementChild!.children);
    const delays = rows.map((row) => (readMotion(row).transition as { delay: number }).delay);
    expect(delays[3]).toBeCloseTo(0.105);
    expect(delays[7]).toBeCloseTo(0.245);
    // Do 8º item em diante, todos repetem o atraso do 8º.
    expect(delays.slice(7)).toEqual(Array(5).fill(delays[7]));
    expect(new Set(delays).size).toBeLessThanOrEqual(8);
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
