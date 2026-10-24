import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CSS global do layout raiz", () => {
  it("não importa a skin Arc, para que a flag desligada preserve o CRM normal", () => {
    const source = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(source).toContain('import "./globals.css";');
    expect(source).not.toMatch(/import\s+["'][^"']*\/(?:venancor-scope|director-skin)\.css["']/);
  });

  it("não puxa o chrome Lite por import estático no shell normal", () => {
    const source = readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");

    expect(source).not.toMatch(/import\s+\{\s*LightChrome\s*\}\s+from\s+["']@\/components\/light\/light-chrome["']/);
    expect(source).toContain('dynamic(() => import("@/components/light/light-chrome")');
    expect(source).toContain('<DirectorLiteStyleGate enabled={directorLiteEnabled} />');
  });
});
