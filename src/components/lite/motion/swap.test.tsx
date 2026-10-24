// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

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

  it("renders the content with reduced motion", () => {
    motionState.reduce = true;
    render(<LiteSwap swapKey="a"><p>Aba A</p></LiteSwap>);
    expect(screen.getByText("Aba A")).toBeInTheDocument();
  });
});
