// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => motionState.reduce };
});

import { LiteReveal } from "./reveal";

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  motionState.reduce = false;
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
afterEach(cleanup);

describe("LiteReveal", () => {
  it("renders the section that reveals on scroll", () => {
    render(<LiteReveal><p>Configuração de WhatsApp</p></LiteReveal>);
    expect(screen.getByText("Configuração de WhatsApp")).toBeInTheDocument();
  });

  it("renders the section with reduced motion", () => {
    motionState.reduce = true;
    render(<LiteReveal amount={0.5}><p>Configuração de WhatsApp</p></LiteReveal>);
    expect(screen.getByText("Configuração de WhatsApp")).toBeInTheDocument();
  });
});
