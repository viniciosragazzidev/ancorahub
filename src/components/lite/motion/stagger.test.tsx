// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteStagger, LiteStaggerItem } from "./stagger";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteStagger", () => {
  it("renders every child, including past the cascade cap", () => {
    const items = Array.from({ length: 12 }, (_, i) => <p key={i}>Linha {i + 1}</p>);
    render(<LiteStagger>{items}</LiteStagger>);
    expect(screen.getAllByText(/^Linha /)).toHaveLength(12);
    expect(screen.getByText("Linha 12")).toBeInTheDocument();
  });

  it("renders a single item with its index and reduced motion", () => {
    motionState.reduce = true;
    render(<LiteStaggerItem index={20}><p>Último</p></LiteStaggerItem>);
    expect(screen.getByText("Último")).toBeInTheDocument();
  });
});
