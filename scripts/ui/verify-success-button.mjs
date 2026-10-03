import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, expect } from "@playwright/test";

// Synthetic shared-button QA: no authentication, lead data or assignment requests.
const output = resolve("reports/agent/verification/lead-assignment-green");
await mkdir(output, { recursive: true });
const [js, styles] = await Promise.all([
  build({
    stdin: {
      contents: `import React from "react";
        import { createRoot } from "react-dom/client";
        import { Button } from "@/components/ui/button";
        createRoot(document.getElementById("root")).render(
          <main className="grid gap-4 p-6 bg-background text-foreground">
            <Button variant="success" type="submit">Confirmar reatribuição</Button>
            <Button variant="success" disabled>Reatribuindo...</Button>
          </main>
        );`,
      loader: "tsx", resolveDir: process.cwd(),
    },
    bundle: true, write: false, format: "iife", platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' }, tsconfig: "tsconfig.json",
  }),
  postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), {
    from: resolve("src/app/globals.css"),
  }),
]);
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 200 }, reducedMotion: "reduce" });
  await page.setContent('<html lang="pt-BR"><body><div id="root"></div></body></html>');
  await page.addStyleTag({ content: styles.css });
  // Measure final colors, not intermediate frames of existing shared transitions.
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
  await page.addScriptTag({ content: js.outputFiles[0].text });
  const button = page.getByRole("button", { name: "Confirmar reatribuição" });
  await expect(button).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reatribuindo..." })).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(button).toBeFocused();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
    for (const state of ["normal", "hover"]) {
      if (state === "hover") await button.hover();
      else await page.mouse.move(0, 0);
      const colors = await button.evaluate((element) => {
        const style = getComputedStyle(element);
        const context = document.createElement("canvas").getContext("2d");
        const rgba = (color) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data);
        };
        const surface = rgba(getComputedStyle(element.parentElement).backgroundColor);
        const background = rgba(style.backgroundColor);
        const alpha = background[3] / 255;
        const composite = background.slice(0, 3).map((v, i) => v * alpha + surface[i] * (1 - alpha));
        const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
          .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        const a = luminance(composite), b = luminance(rgba(style.color).slice(0, 3));
        return { background: style.backgroundColor, foreground: style.color,
          contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
          green: composite[1] > composite[0] && composite[1] > composite[2],
          focusRing: style.boxShadow !== "none" };
      });
      expect(colors.green).toBe(true);
      expect(colors.contrast).toBeGreaterThanOrEqual(4.5);
      expect(colors.focusRing).toBe(true);
      results.push({ theme, state, ...colors });
    }
    await page.screenshot({ path: resolve(output, `${theme}.png`) });
  }
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
