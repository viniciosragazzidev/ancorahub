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

  it("scales the button to 0.97 on press when motion is on", () => {
    const { container } = render(<LitePress><button>Salvar</button></LitePress>);
    expect(readMotion(container.firstElementChild!).whileTap).toEqual({ scale: 0.97 });
  });

  it("does not scale on press with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LitePress><button>Salvar</button></LitePress>);
    const motion = readMotion(container.firstElementChild!);
    expect(motion.whileTap).toBeUndefined();
    expect(displacementOf(motion.whileTap)).toEqual([]);
  });
});
