// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteNumber } from "./number";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteNumber", () => {
  it("formats integers in pt-BR with a thousands separator", () => {
    render(<LiteNumber value={1234} />);
    expect(screen.getByText("1.234")).toBeInTheDocument();
  });

  it("formats currency in BRL", () => {
    render(<LiteNumber value={1234.5} format="currency" />);
    expect(screen.getByText("R$ 1.234,50")).toBeInTheDocument();
  });

  it("formats percent without a space, with the value in percentage points", () => {
    motionState.reduce = true;
    render(<LiteNumber value={12} format="percent" />);
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("starts from zero when counting from zero and the motion is on", () => {
    render(<LiteNumber value={1234} countFromZero />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows the final value at once with reduced motion", () => {
    motionState.reduce = true;
    render(<LiteNumber value={1234} countFromZero />);
    expect(screen.getByText("1.234")).toBeInTheDocument();
  });
});
