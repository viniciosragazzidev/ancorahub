// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ system: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.system };
});

import { useReduce } from "./motion";

function Probe() {
  return <p>{useReduce() ? "reduzido" : "normal"}</p>;
}

beforeEach(() => {
  motionState.system = false;
  delete document.documentElement.dataset.reduceMotion;
});
afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.reduceMotion;
});

describe("movimento reduzido do painel", () => {
  it("é normal sem preferência do sistema nem do site", () => {
    render(<Probe />);
    expect(screen.getByText("normal")).toBeInTheDocument();
  });

  it("vale pela preferência do sistema", () => {
    motionState.system = true;
    render(<Probe />);
    expect(screen.getByText("reduzido")).toBeInTheDocument();
  });

  it("vale pela preferência do site, e muda quando ela muda", async () => {
    render(<Probe />);
    expect(screen.getByText("normal")).toBeInTheDocument();
    act(() => {
      document.documentElement.dataset.reduceMotion = "1";
    });
    await waitFor(() => expect(screen.getByText("reduzido")).toBeInTheDocument());
    act(() => {
      document.documentElement.dataset.reduceMotion = "0";
    });
    await waitFor(() => expect(screen.getByText("normal")).toBeInTheDocument());
  });
});
