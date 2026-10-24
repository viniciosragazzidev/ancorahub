// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LitePress } from "./press";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LitePress", () => {
  it("wraps the pressable content for each kind", () => {
    const { rerender } = render(<LitePress kind="row"><button>Abrir lead</button></LitePress>);
    expect(screen.getByRole("button", { name: "Abrir lead" })).toBeInTheDocument();
    rerender(<LitePress kind="card"><button>Abrir card</button></LitePress>);
    expect(screen.getByRole("button", { name: "Abrir card" })).toBeInTheDocument();
  });

  it("keeps the content with reduced motion (no press scale)", () => {
    motionState.reduce = true;
    render(<LitePress><button>Salvar</button></LitePress>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeInTheDocument();
  });
});
