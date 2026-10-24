import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { DIRECTOR_LITE_PORTAL_ROOT_ID, getArcScopeProps } from "./arc-scope-context";

const uiRoot = join(process.cwd(), "src", "components", "ui");

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(absolute) : entry.name.endsWith(".tsx") ? [absolute] : [];
  });
}

describe("escopo Arc do Diretor", () => {
  it("não adiciona classe ou skin quando o provider está desligado", () => {
    expect(getArcScopeProps(false)).toEqual({});
  });

  it("expõe classe, skin e raiz isolada para o piloto ativo", () => {
    expect(getArcScopeProps(true)).toEqual({ className: "arc-venancor", "data-skin": "diretor" });
    expect(DIRECTOR_LITE_PORTAL_ROOT_ID).toBe("director-lite-portal-root");
  });

  it("aplica o escopo em cada wrapper de Portal ou Popup do UI compartilhado", () => {
    const directPortalWrappers = filesIn(uiRoot).filter((file) => {
      const source = readFileSync(file, "utf8");
      return /\.(?:Portal|Popup)\b/.test(source) || /createPortal\(/.test(source);
    });
    const missing = directPortalWrappers.filter((file) => !readFileSync(file, "utf8").includes("useArcScopeProps"));
    expect(missing.map((file) => relative(uiRoot, file))).toEqual([]);
    expect(directPortalWrappers.map((file) => relative(uiRoot, file))).toEqual(expect.arrayContaining([
      "dialog.tsx", "sheet.tsx", "drawer.tsx", "popover.tsx", "dropdown-menu.tsx", "tooltip.tsx", "ds-dialog.tsx", "ds-sheet.tsx", "sortable.tsx",
    ]));

    expect(readFileSync(join(uiRoot, "command.tsx"), "utf8")).toContain("DialogPopup");
    expect(readFileSync(join(uiRoot, "combobox.tsx"), "utf8")).toContain("PopoverContent");
  });
});
