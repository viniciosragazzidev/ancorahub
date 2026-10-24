// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteSuccess } from "./success";

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteSuccess", () => {
  it("announces the label as a status", () => {
    render(<LiteSuccess label="Salvo" />);
    expect(screen.getByRole("status")).toHaveTextContent("Salvo");
  });

  it("draws the check hidden from assistive tech", () => {
    const { container } = render(<LiteSuccess label="Salvo" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders with reduced motion", () => {
    motionState.reduce = true;
    render(<LiteSuccess label="Enviado" />);
    expect(screen.getByRole("status")).toHaveTextContent("Enviado");
  });
});
