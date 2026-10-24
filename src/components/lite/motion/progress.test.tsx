// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

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

  it("renders the final bar with reduced motion", () => {
    motionState.reduce = true;
    render(<LiteProgress value={75} label="Upload" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "75");
  });
});
