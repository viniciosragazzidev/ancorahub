// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

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

  it("adds one decorative pulse layer when the pulse key is set", () => {
    const { container } = render(<LiteAttention pulseKey={1}><span>Sino</span></LiteAttention>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("renders the pulse layer with reduced motion too", () => {
    motionState.reduce = true;
    const { container } = render(<LiteAttention pulseKey="novo"><span>Sino</span></LiteAttention>);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
