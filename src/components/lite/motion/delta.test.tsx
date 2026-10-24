// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteDelta } from "./delta";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteDelta", () => {
  it("shows a positive variation with a plus sign and the up tone", () => {
    render(<LiteDelta value={12} />);
    const pill = screen.getByText("+12%");
    expect(pill).toHaveAttribute("data-tone", "up");
  });

  it("shows a negative variation with the down tone and a flat one without sign", () => {
    const { rerender } = render(<LiteDelta value={-5} />);
    expect(screen.getByText("-5%")).toHaveAttribute("data-tone", "down");
    rerender(<LiteDelta value={0} />);
    expect(screen.getByText("0%")).toHaveAttribute("data-tone", "flat");
  });

  it("renders with reduced motion too", () => {
    motionState.reduce = true;
    render(<LiteDelta value={3} />);
    expect(screen.getByText("+3%")).toBeInTheDocument();
  });
});
