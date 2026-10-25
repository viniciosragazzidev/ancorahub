import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../arc/director-chrome.css", import.meta.url), "utf8");
const sectionTabs = css.slice(css.indexOf("/* Abas por URL"));

describe("abas por URL no chrome do diretor", () => {
  it("estiliza como chips apenas dentro do skin do diretor e mantém alvos de 44px", () => {
    for (const label of ["Seções do atendimento", "Gestão de equipe e unidades", "Canais WhatsApp"]) {
      expect(sectionTabs).toContain(`.arc-venancor[data-skin="diretor"] nav[aria-label="${label}"]`);
    }
    expect(sectionTabs).toContain("min-height: var(--control-height-sm, 44px)");
    expect(sectionTabs).toContain("background: var(--surface-muted, var(--muted))");
    expect(sectionTabs).toContain("background: var(--surface, var(--card))");
    expect(sectionTabs).toContain("display: none");
  });
});
