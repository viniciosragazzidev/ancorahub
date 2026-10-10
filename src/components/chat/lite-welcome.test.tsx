// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { LiteWelcome } from "./lite-welcome";

beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("LiteWelcome", () => {
  it("welcomes once, then never again on this device", () => {
    render(<LiteWelcome />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.getByRole("dialog", { name: "O app do corretor mudou" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    act(() => { vi.advanceTimersByTime(500); });
    cleanup();
    render(<LiteWelcome />);
    act(() => { vi.advanceTimersByTime(400); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
