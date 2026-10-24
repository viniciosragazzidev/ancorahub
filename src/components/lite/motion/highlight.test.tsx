// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteHighlight } from "./highlight";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteHighlight", () => {
  it("renders the highlight only on the active item", () => {
    const { container, rerender } = render(<LiteHighlight layoutId="aba" active={false} />);
    expect(container.querySelector("span")).toBeNull();
    rerender(<LiteHighlight layoutId="aba" active />);
    expect(container.querySelector("span")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the highlight decorative and renders with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LiteHighlight layoutId="aba" active className="fundo" />);
    const span = container.querySelector("span");
    expect(span).toHaveClass("fundo");
    expect(span).toHaveAttribute("aria-hidden", "true");
  });
});
