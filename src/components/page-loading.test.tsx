// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArcScopeProvider } from "./arc/arc-scope-context";
import { PageLoading } from "./page-loading";
import { RouteLoading } from "./route-loading";

const css = readFileSync(join(process.cwd(), "src/components/page-loading.module.css"), "utf8");

afterEach(() => {
  cleanup();
});

describe("carregamento de página inteira", () => {
  it("anuncia o carregamento como status educado com o texto padrão", () => {
    render(<PageLoading />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("Carregando…");
  });

  it("aceita o texto da tela e esconde o indicador do leitor de tela", () => {
    render(<PageLoading label="Carregando financeiro…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando financeiro…");
    expect(screen.getByTestId("page-loading-indicator")).toHaveAttribute("aria-hidden", "true");
  });

  it("centraliza na altura útil com dvh e entra com atraso para não piscar", () => {
    expect(css).toContain("100dvh");
    expect(css).not.toContain("100vh");
    expect(css).toContain("place-items: center");
    expect(css).toMatch(/animation: page-loading-in [^;]+ 200ms forwards/);
  });

  it("fica estático com movimento reduzido e com a chave de movimento desligada", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.ring,\s*\.core\s*\{\s*animation: none;/);
    expect(css).toMatch(/html\[data-interface-motion="off"\]\) \.ring,\s*:global\(html\[data-interface-motion="off"\]\) \.core\s*\{\s*animation: none;/);
  });

  it("usa só tokens do tema, sem cor crua", () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it("troca de rota usa o carregamento centralizado, com e sem a pele do diretor", () => {
    const { container, unmount } = render(<RouteLoading label="Carregando leads…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando leads…");
    expect(container.querySelector("main")?.className).not.toContain("arc-venancor");
    unmount();
    const director = render(<ArcScopeProvider enabled><RouteLoading /></ArcScopeProvider>);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando…");
    expect(director.container.querySelector("main")).toHaveAttribute("data-skin", "diretor");
  });
});
