import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { motionTokens as canonical } from "@/components/arc/motion-tokens";
import { motionTokens as legacyLib } from "@/lib/motion/motion-tokens";
import { motionTokens as legacyShared, ease as legacyEase } from "@/shared/animations/variants";

/**
 * Fonte única de movimento (plano 2026-11-18, etapa 0): os valores vivem em
 * src/components/arc/motion-tokens.ts. Toda folha CSS que repete um token tem de
 * repetir o mesmo valor; os conjuntos JS antigos só podem apontar para o canônico.
 */

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");
const ms = (seconds: number) => `${Math.round(seconds * 1000)}ms`;
const bezier = (points: readonly number[]) => `cubic-bezier(${points.join(", ")})`;
const normalize = (value: string) => value.replace(/\s+/g, "").replace(/(^|[,(])0\./g, "$1.");

function declarations(css: string) {
  const map = new Map<string, string[]>();
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const list = map.get(match[1]) ?? [];
    list.push(match[2].trim());
    map.set(match[1], list);
  }
  return map;
}

const expected: Record<string, string> = {
  "--duration-instant": ms(canonical.duration.instant),
  "--duration-fast": ms(canonical.duration.fast),
  "--duration-exit": ms(canonical.duration.exit),
  "--duration-standard": ms(canonical.duration.standard),
  "--duration-draw": ms(canonical.duration.draw),
  "--duration-considered": ms(canonical.duration.considered),
  "--duration-stagger": ms(canonical.stagger.item),
  "--motion-duration-instant": ms(canonical.duration.instant),
  "--motion-duration-fast": ms(canonical.duration.fast),
  "--motion-duration-exit": ms(canonical.duration.exit),
  "--motion-duration-standard": ms(canonical.duration.standard),
  "--ease-enter": bezier(canonical.ease.enter),
  "--ease-standard": bezier(canonical.ease.standard),
  "--ease-exit": bezier(canonical.ease.exit),
};

const sheets = [
  "src/app/globals.css",
  "src/components/lite/motion/motion-tokens.css",
  "src/components/arc/foundation.css",
  "src/components/arc/venancor-scope.css",
  "src/components/arc/director-skin.css",
];

describe("tokens de movimento: uma fonte só", () => {
  it.each(sheets)("%s repete os valores canônicos", (sheet) => {
    const found = declarations(read(sheet));
    for (const [name, value] of Object.entries(expected)) {
      for (const declared of found.get(name) ?? []) {
        if (declared.startsWith("var(")) continue;
        expect(normalize(declared), `${sheet} ${name}`).toBe(normalize(value));
      }
    }
  });

  it("globals.css declara todos os nomes canônicos", () => {
    const found = declarations(read("src/app/globals.css"));
    for (const name of ["--duration-instant", "--duration-fast", "--duration-exit", "--duration-standard", "--duration-draw", "--duration-considered", "--duration-stagger", "--ease-enter", "--ease-standard", "--ease-exit"]) {
      expect(found.has(name), name).toBe(true);
    }
  });

  it("apelidos antigos apontam para o canônico", () => {
    const found = declarations(read("src/app/globals.css"));
    expect(found.get("--duration-quick")).toEqual(["var(--duration-fast)"]);
    expect(found.get("--motion-duration-normal")).toEqual(["var(--duration-standard)"]);
    expect(found.get("--ease-smooth-out")).toEqual(["var(--ease-standard)"]);
  });

  it("conjuntos JS antigos usam os valores canônicos", () => {
    const allowed = new Set<number>(Object.values(canonical.duration));
    for (const value of [...Object.values(legacyLib.duration), ...Object.values(legacyShared.duration)]) {
      expect(allowed.has(value), String(value)).toBe(true);
    }
    expect(legacyShared.delay.stagger).toBe(canonical.stagger.item);
    expect(legacyEase.standard).toEqual(canonical.ease.standard);
    expect(legacyLib.easings.smoothOut).toEqual(canonical.ease.standard);
  });
});
