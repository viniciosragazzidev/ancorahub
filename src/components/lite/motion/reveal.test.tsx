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

  it("rises 12 px and reveals once when motion is on", () => {
    const { container } = render(<LiteReveal><p>Bloco</p></LiteReveal>);
    const motion = readMotion(container.firstElementChild!);
    expect(motion.initial).toEqual({ opacity: 0, y: 12 });
    expect(motion.whileInView).toEqual({ opacity: 1, y: 0 });
  });

  it("has no displacement with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LiteReveal amount={0.5}><p>Bloco</p></LiteReveal>);
    const motion = readMotion(container.firstElementChild!);
    expect(motion.initial).toEqual({ opacity: 0 });
    expect(displacementOf(motion.whileInView)).toEqual([]);
  });
});
