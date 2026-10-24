import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CSS do diretor Lite", () => {
  it("o layout raiz não importa as folhas Arc", () => {
    const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(source).toContain('import "./globals.css";');
    expect(source).not.toMatch(/import\s+["'][^"']*\/(?:venancor-scope|director-skin)\.css["']/);
  });

  it("o shell mantém o LightChrome estático (sem mudar o Lite) e a skin do diretor só tem regras sob data-skin", () => {
    const shell = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
    expect(shell).toMatch(/import\s+\{\s*LightChrome\s*\}\s+from\s+["']@\/components\/light\/light-chrome["']/);
    expect(shell).toContain('import "@/components/arc/director-skin.css";');

    const skin = readFileSync(join(process.cwd(), "src/components/arc/director-skin.css"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...skin.matchAll(/([^{}@;]+)\{/g)]
      .map((match) => match[1].trim())
      .filter((selector) => selector && !/^(from|to|\d+%)$/.test(selector) && !selector.startsWith("@"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      for (const part of selector.split(",")) expect(part).toContain('[data-skin="diretor"]');
    }
  });

  it("venancor-scope.css segue igual ao de antes da F0a", () => {
    const scope = readFileSync(join(process.cwd(), "src/components/arc/venancor-scope.css"), "utf8");
    expect(scope).toContain('html[data-text-scale="115"] { font-size: 115%; }');
  });
});
