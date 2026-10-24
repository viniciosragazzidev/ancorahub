import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("isolamento das folhas Arc", () => {
  it("mantém só globals.css no layout raiz", () => {
    const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(source).toContain('import "./globals.css";');
    expect(source).not.toMatch(/import\s+["'][^"']*\/(?:venancor-scope|director-skin|director-primitives)\.css["']/);
  });

  it("não importa estaticamente as folhas de chrome no shell normal", () => {
    const source = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");

    expect(source).not.toMatch(/import\s+\{\s*LightChrome\s*\}\s+from\s+["']@\/components\/light\/light-chrome["']/);
    expect(source).not.toMatch(/import\s+["'][^"']*director-skin\.css["']/);
    expect(source).toContain('dynamic(() => import("@/components/light/light-chrome")');
    expect(source).toContain('<DirectorLiteStyleGate enabled={directorLiteEnabled} />');
  });
});
