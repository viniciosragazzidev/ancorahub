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
import { LiteSwap } from "./swap";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteSwap", () => {
  it("shows the content for the current key", () => {
    render(<LiteSwap swapKey="a"><p>Aba A</p></LiteSwap>);
    expect(screen.getByText("Aba A")).toBeInTheDocument();
  });

  it("shows the new content when the key changes", () => {
    const { rerender } = render(<LiteSwap swapKey="a"><p>Aba A</p></LiteSwap>);
    rerender(<LiteSwap swapKey="b"><p>Aba B</p></LiteSwap>);
    expect(screen.getByText("Aba B")).toBeInTheDocument();
  });

  it("enters 4 px below when motion is on", () => {
    const { container } = render(<LiteSwap swapKey="a"><p>Aba A</p></LiteSwap>);
    expect(readMotion(container.firstElementChild!).initial).toEqual({ opacity: 0, y: 4 });
  });

  it("only fades with reduced motion, entering and leaving", () => {
    motionState.reduce = true;
    const { container } = render(<LiteSwap swapKey="a"><p>Aba A</p></LiteSwap>);
    const motion = readMotion(container.firstElementChild!);
    expect(motion.initial).toEqual({ opacity: 0 });
    expect(displacementOf(motion.initial)).toEqual([]);
    expect(displacementOf(motion.exit)).toEqual([]);
  });
});
