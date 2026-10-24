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
import { LiteSuccess } from "./success";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteSuccess", () => {
  it("announces the label as a status", () => {
    render(<LiteSuccess label="Salvo" />);
    expect(screen.getByRole("status")).toHaveTextContent("Salvo");
  });

  it("draws the check from zero over 0.32 s when motion is on", () => {
    const { container } = render(<LiteSuccess label="Salvo" />);
    const path = container.querySelector("svg")!.firstElementChild!;
    expect(readMotion(path).initial).toEqual({ pathLength: 0 });
    expect((readMotion(path).transition as { duration: number }).duration).toBeCloseTo(0.32);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the finished check with reduced motion and no displacement", () => {
    motionState.reduce = true;
    const { container } = render(<LiteSuccess label="Enviado" />);
    const svg = container.querySelector("svg")!;
    expect(readMotion(svg.firstElementChild!).initial).toEqual({ pathLength: 1 });
    expect(displacementOf(readMotion(svg).initial)).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Enviado");
  });
});
