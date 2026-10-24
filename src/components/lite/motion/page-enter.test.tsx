// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

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

  it("renders the page content with reduced motion", () => {
    motionState.reduce = true;
    render(<LitePageEnter><h1>Painel</h1></LitePageEnter>);
    expect(screen.getByRole("heading", { name: "Painel" })).toBeInTheDocument();
  });
});
