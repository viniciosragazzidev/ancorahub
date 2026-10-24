// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// useReduce reads the system preference through matchMedia (stable on the server, applied after mount).
const motionState = { system: false };
function stubMatchMedia() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") && motionState.system,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

import { useReduce } from "./motion";

function Probe() {
  return <p>{useReduce() ? "reduzido" : "normal"}</p>;
}

beforeEach(() => {
  motionState.system = false;
  stubMatchMedia();
  delete document.documentElement.dataset.reduceMotion;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.reduceMotion;
});

describe("movimento reduzido do painel", () => {
  it("é normal sem preferência do sistema nem do site", () => {
    render(<Probe />);
    expect(screen.getByText("normal")).toBeInTheDocument();
  });

  it("vale pela preferência do sistema", async () => {
    motionState.system = true;
    render(<Probe />);
    await waitFor(() => expect(screen.getByText("reduzido")).toBeInTheDocument());
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
