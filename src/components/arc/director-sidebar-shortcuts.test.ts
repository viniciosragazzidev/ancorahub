import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = ["./director-chrome.css", "./director-accordee.css"].map((path) => ({
  path,
  css: readFileSync(new URL(path, import.meta.url), "utf8"),
}));

describe("atalhos do topo da sidebar do diretor", () => {
  it("a caixa do logo não pega o primeiro link do bloco de atalhos", () => {
    // Sem a Visão do super-admin (diretora comum, como a Taina), a Área de Plantão é o primeiro filho do bloco de
    // atalhos. Uma regra "> div > a:first-child" sem exclusão dava a ela os 28px do logo e escondia o rótulo.
    for (const { path, css } of files) {
      const unscoped = css.match(/\[data-slot="sidebar-header"\]\s*>\s*div\s*>\s*a:first-child/g) ?? [];
      expect(unscoped, path).toEqual([]);
      expect(css, path).toContain('[data-slot="sidebar-header"] > div:not(.director-shortcuts) > a:first-child');
    }
  });

  it("o link do plantão ocupa a largura do bloco", () => {
    const accordee = files.find((file) => file.path.endsWith("accordee.css"))!.css;
    expect(accordee).toMatch(/\.director-sidebar \.director-duty-link \{[^}]*width: 100%/);
  });
});
