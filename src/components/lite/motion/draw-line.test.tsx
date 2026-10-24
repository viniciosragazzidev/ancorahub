// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteDrawLine } from "./draw-line";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteDrawLine", () => {
  it("renders the line as a labelled image with its path", () => {
    const { container } = render(<LiteDrawLine d="M0 10 L10 0" viewBox="0 0 10 10" label="Leads por dia" />);
    expect(screen.getByRole("img", { name: "Leads por dia" })).toBeInTheDocument();
    expect(container.querySelector("path")).toHaveAttribute("d", "M0 10 L10 0");
  });

  it("renders the drawn line at once with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LiteDrawLine d="M0 10 L10 0" viewBox="0 0 10 10" label="Leads por dia" />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });
});
