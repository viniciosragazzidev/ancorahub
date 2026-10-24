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

  it("enters 4 px above and leaves by collapsing grid rows, never by animating height", () => {
    const { container } = render(
      <LiteListPresence>
        <p key="a">Lead A</p>
      </LiteListPresence>,
    );
    const row = container.firstElementChild!.firstElementChild!;
    const motion = readMotion(row);
    expect(motion.initial).toEqual({ opacity: 0, y: -4 });
    expect(motion.exit).toMatchObject({ opacity: 0, gridTemplateRows: "0fr" });
    expect(JSON.stringify(motion.exit)).not.toMatch(/height/);
    expect((row as HTMLElement).style.display).toBe("grid");
  });

  it("only fades with reduced motion and does not collapse or move", () => {
    motionState.reduce = true;
    const { container } = render(
      <LiteListPresence>
        <p key="a">Lead A</p>
      </LiteListPresence>,
    );
    const motion = readMotion(container.firstElementChild!.firstElementChild!);
    expect(motion.initial).toEqual({ opacity: 0 });
    expect(motion.exit).toEqual({ opacity: 0, transition: { duration: 0.12 } });
    expect(displacementOf(motion.initial)).toEqual([]);
    expect(JSON.stringify(motion.exit)).not.toMatch(/gridTemplateRows/);
  });
});
