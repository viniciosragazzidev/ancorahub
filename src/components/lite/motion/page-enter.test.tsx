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
import { LitePageEnter } from "./page-enter";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LitePageEnter", () => {
  it("renders the page content with its class", () => {
    render(<LitePageEnter className="pagina"><h1>Painel</h1></LitePageEnter>);
    expect(screen.getByRole("heading", { name: "Painel" }).parentElement).toHaveClass("pagina");
  });

  it("enters from 8 px below when motion is on", () => {
    const { container } = render(<LitePageEnter><h1>Painel</h1></LitePageEnter>);
    expect(readMotion(container.firstElementChild!).initial).toEqual({ opacity: 0, y: 8 });
  });

  it("has no displacement with reduced motion: only opacity", () => {
    motionState.reduce = true;
    const { container } = render(<LitePageEnter><h1>Painel</h1></LitePageEnter>);
    const motion = readMotion(container.firstElementChild!);
    expect(motion.initial).toEqual({ opacity: 0 });
    expect(displacementOf(motion.initial)).toEqual([]);
    expect(displacementOf(motion.animate)).toEqual([]);
  });
});
