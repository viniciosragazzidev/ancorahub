// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BrandSurface } from "./brand-surface";

afterEach(cleanup);

const css = readFileSync(join(process.cwd(), "src/components/brand/brand-surface.module.css"), "utf8");

describe("BrandSurface (exceção de superfície de marca)", () => {
  it("é uma seção por padrão e aceita outro elemento", () => {
    const { rerender } = render(<BrandSurface aria-label="Marca">texto</BrandSurface>);
    expect(screen.getByRole("region", { name: "Marca" })).toHaveAttribute("data-slot", "brand-surface");
    rerender(<BrandSurface as="div" data-testid="raiz">texto</BrandSurface>);
    expect(screen.getByTestId("raiz").tagName).toBe("DIV");
  });

  it("usa o azul dos tokens, sem gradiente, com o pontilhado de 12px a 12%", () => {
    expect(css).toContain("var(--color-ds-electric-blue)");
    expect(css).not.toMatch(/linear-gradient|radial-gradient/);
    expect(css).toContain("background-size: 12px 12px");
    expect(css).toContain("fill-opacity='.12'");
  });
});
