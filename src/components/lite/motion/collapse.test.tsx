// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteCollapse } from "./collapse";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteCollapse", () => {
  it("opens with the grid row at full height and visible", () => {
    const { container } = render(<LiteCollapse open><p>Detalhe</p></LiteCollapse>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateRows).toBe("1fr");
    expect(grid.style.opacity).toBe("1");
    expect(grid).not.toHaveAttribute("inert");
  });

  it("closes to zero rows and is inert so it cannot be focused", () => {
    const { container } = render(<LiteCollapse open={false}><button>Ver mais</button></LiteCollapse>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.gridTemplateRows).toBe("0fr");
    expect(grid).toHaveAttribute("inert");
    expect(grid).toHaveAttribute("aria-hidden", "true");
  });

  it("never moves the content: no transform on the grid or its child", () => {
    const { container } = render(<LiteCollapse open><p>Detalhe</p></LiteCollapse>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.transform).toBe("");
    expect(grid.firstElementChild!.getAttribute("style")).not.toMatch(/transform/);
  });

  it("only changes opacity on the transition with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LiteCollapse open><p>Detalhe</p></LiteCollapse>);
    const grid = container.firstElementChild as HTMLElement;
    expect(grid.style.transition).toContain("opacity");
    expect(grid.style.transition).not.toContain("grid-template-rows");
    expect(screen.getByText("Detalhe")).toBeInTheDocument();
  });
});
