// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getArcScopeProps } from "./arc-scope-context";

const source = readFileSync(join(process.cwd(), "src/components/arc/venancor-scope.css"), "utf8");
const textScaleRules = source.match(/html\[data-text-scale="(?:115|130)"\][^{]*\{[^}]+\}/g)?.join("\n") ?? "";

afterEach(() => {
  document.head.querySelector("style[data-testid='arc-text-scale-test']")?.remove();
  document.documentElement.removeAttribute("data-text-scale");
  document.documentElement.style.removeProperty("font-size");
  document.body.innerHTML = "";
});

describe("escala de texto Arc", () => {
  it("não inclui a classe Arc na árvore do CRM com preferência 115% e piloto desligado", () => {
    document.documentElement.dataset.textScale = "115";
    const scope = getArcScopeProps(false);
    const crm = document.createElement("main");
    crm.className = ["crm-page", scope.className].filter(Boolean).join(" ");
    document.body.append(crm);

    expect(crm.className).toBe("crm-page");
    expect(document.documentElement.matches('html[data-text-scale="115"]:has(.arc-venancor)')).toBe(false);
    expect(textScaleRules).toContain(':has(.arc-venancor)');
  });

  it("mantém a escala de 115% condicionada a telas com escopo Arc", () => {
    const style = document.createElement("style");
    style.dataset.testid = "arc-text-scale-test";
    style.textContent = textScaleRules;
    document.head.append(style);
    document.documentElement.dataset.textScale = "115";
    document.documentElement.style.fontSize = "100%";
    document.body.innerHTML = '<main class="arc-venancor"></main>';

    expect(document.documentElement.matches('html[data-text-scale="115"]:has(.arc-venancor)')).toBe(true);
    expect(textScaleRules).toContain('font-size: 115%');
  });
});
