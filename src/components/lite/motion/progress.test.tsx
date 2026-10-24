// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("./capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

import { readMotion } from "./capture-motion";
import { LiteProgress } from "./progress";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteProgress", () => {
  it("exposes the value as a progressbar", () => {
    render(<LiteProgress value={40} label="Importando planilha" />);
    const bar = screen.getByRole("progressbar", { name: "Importando planilha" });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("limits values outside 0 to 100", () => {
    const { rerender } = render(<LiteProgress value={150} label="Upload" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<LiteProgress value={-3} label="Upload" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("starts the fill from zero width and grows with scaleX when motion is on", () => {
    const { container } = render(<LiteProgress value={75} label="Upload" />);
    expect(readMotion(container.querySelector("[role=progressbar] > div")!).initial).toEqual({ scaleX: 0 });
  });

  it("shows the final width at once with reduced motion, with no movement", () => {
    motionState.reduce = true;
    const { container } = render(<LiteProgress value={75} label="Upload" />);
    expect(readMotion(container.querySelector("[role=progressbar] > div")!).initial).toEqual({ scaleX: 0.75 });
  });
});
