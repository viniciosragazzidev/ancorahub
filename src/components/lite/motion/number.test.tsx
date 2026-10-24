// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("./capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

import { LiteNumber } from "./number";

/** Texto que um leitor de tela recebe: a região sr-only, sem a coluna de dígitos. */
function spokenText(container: HTMLElement) {
  return container.querySelector(".sr-only")?.textContent?.replace(/ /g, " ");
}

beforeEach(() => {
  motionState.reduce = false;
});
afterEach(cleanup);

describe("LiteNumber", () => {
  it("formats integers in pt-BR with a thousands separator", () => {
    const { container } = render(<LiteNumber value={1234} />);
    expect(spokenText(container)).toBe("1.234");
  });

  it("formats currency in BRL", () => {
    const { container } = render(<LiteNumber value={1234.5} format="currency" />);
    expect(spokenText(container)).toBe("R$ 1.234,50");
  });

  it("formats percent without a space, with the value in percentage points", () => {
    const { container } = render(<LiteNumber value={12} format="percent" />);
    expect(spokenText(container)).toBe("12%");
  });

  it("renders the final value in the first HTML, even when it counts from zero", () => {
    const { container } = render(<LiteNumber value={1234} countFromZero />);
    expect(spokenText(container)).toBe("1.234");
    // "1.234": quatro colunas de dígito e o separador de milhar como texto estático.
    expect(container.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(5);
  });

  it("draws each digit as a column of 0 to 9", () => {
    const { container } = render(<LiteNumber value={42} />);
    const firstColumn = container.querySelector('[aria-hidden="true"] > span > span')!;
    expect(Array.from(firstColumn.children).map((child) => child.textContent)).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("announces the final value through a live region when asked", () => {
    const { container, rerender } = render(<LiteNumber value={10} live />);
    expect(container.querySelector(".sr-only")).toHaveAttribute("aria-live", "polite");
    rerender(<LiteNumber value={25} live />);
    expect(spokenText(container)).toBe("25");
  });

  it("shows the final value at once with reduced motion", () => {
    motionState.reduce = true;
    const { container } = render(<LiteNumber value={1234} countFromZero />);
    expect(spokenText(container)).toBe("1.234");
  });
});
