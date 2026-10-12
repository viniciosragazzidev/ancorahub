// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { QuotePaused } from "./quote-paused";

afterEach(() => cleanup());

describe("QuotePaused", () => {
  it("shows the Cotação resting, one tap back to work and no composer", () => {
    render(<QuotePaused />);
    expect(screen.getByRole("heading", { name: "A Cotação está de folga" })).toBeTruthy();
    expect(screen.getAllByText("Em pausa").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Ver meus leads/ })).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLTextAreaElement).disabled).toBe(true);
  });
});
