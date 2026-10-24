// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteListPresence } from "./list-presence";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteListPresence", () => {
  it("renders every keyed row", () => {
    render(
      <LiteListPresence>
        <p key="a">Lead A</p>
        <p key="b">Lead B</p>
      </LiteListPresence>,
    );
    expect(screen.getByText("Lead A")).toBeInTheDocument();
    expect(screen.getByText("Lead B")).toBeInTheDocument();
  });

  it("adds a new row when the list grows", () => {
    const { rerender } = render(
      <LiteListPresence>
        <p key="a">Lead A</p>
      </LiteListPresence>,
    );
    rerender(
      <LiteListPresence>
        <p key="a">Lead A</p>
        <p key="novo">Lead novo</p>
      </LiteListPresence>,
    );
    expect(screen.getByText("Lead novo")).toBeInTheDocument();
  });

  it("renders the rows with reduced motion", () => {
    motionState.reduce = true;
    render(
      <LiteListPresence>
        <p key="a">Lead A</p>
      </LiteListPresence>,
    );
    expect(screen.getByText("Lead A")).toBeInTheDocument();
  });
});
