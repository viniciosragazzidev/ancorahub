import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, expect } from "@playwright/test";

const output = resolve("reports/agent/verification/shared-motion-2026-10-01");
await mkdir(output, { recursive: true });
const [js, styles] = await Promise.all([
  build({
    absWorkingDir: process.cwd(),
    entryPoints: [resolve("scripts/ui/fixtures/shared-motion-preview.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
    tsconfig: "tsconfig.json",
  }),
  postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), {
    from: resolve("src/app/globals.css"),
  }),
]);
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch {
  browser = await chromium.launch({ headless: true, channel: "chrome" });
}
const page = await browser.newPage({
  viewport: { width: 1360, height: 980 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const evidence = [];
try {
  await page.setContent(
    '<!doctype html><html lang="pt-BR" data-interface-motion="off"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>',
  );
  await page.addStyleTag({ content: styles.css });
  await page.addScriptTag({ content: js.outputFiles[0].text });
  await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "on");
  await page.getByRole("switch", { name: "Disponível" }).click();
  await expect(page.getByRole("switch", { name: "Disponível" })).toBeChecked();
  await page.getByRole("checkbox", { name: "Selecionar lead" }).click();
  await expect(page.getByRole("checkbox", { name: "Selecionar lead" })).toBeChecked();
  await page.getByRole("button", { name: "Fila", exact: true }).click();
  await page.getByRole("option", { name: "PME", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fila", exact: true })).toContainText("PME");
  await page.getByRole("button", { name: "Abrir diálogo" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir diálogo" })).toBeFocused();
  evidence.push("Select, checkbox, switch and dialog keyboard/focus passed");
  await page.getByRole("button", { name: "Mais ações", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "Consultar detalhes" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mais ações", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Filtros rápidos", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Cidade", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("textbox", { name: "Cidade", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Salvar exemplo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aguarde…", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Simular confirmação", exact: true }).click();
  await expect(page.getByRole("button", { name: "Concluído", exact: true })).toBeDisabled();
  evidence.push("Menu/popover dismiss with Escape; pending and success button states passed");
  for (const side of ["left", "right", "top", "bottom"]) {
    await page.getByRole("button", { name: `Painel ${side}`, exact: true }).click();
    const panel = page.locator('[data-slot="sheet-content"]');
    await expect(panel).toBeVisible();
    const translate = await panel.evaluate((node) => {
      const clone = node.cloneNode(false);
      clone.style.transition = "none";
      clone.setAttribute("data-starting-style", "");
      document.body.append(clone);
      const value = getComputedStyle(clone).translate;
      clone.remove();
      return value;
    });
    const expected = { left: "-12px", right: "12px", top: "0px -12px", bottom: "0px 12px" };
    expect(translate.startsWith(expected[side])).toBe(true);
    evidence.push(`${side} sheet enters from ${translate}`);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  }
  await page.getByRole("tab", { name: "Detalhes", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("O indicador");
  await page.screenshot({ path: resolve(output, "desktop.png"), fullPage: true });
  await page.getByTestId("governance").click();
  await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "off");
  expect(
    await page.getByTestId("press").evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe("0s");
  await expect(page.getByRole("switch", { name: "Disponível" })).toBeChecked();
  await page.getByRole("button", { name: "Abrir diálogo" }).click();
  expect(
    await page.getByRole("dialog").evaluate((node) => getComputedStyle(node).transitionDuration),
  ).toBe("0s");
  await page.keyboard.press("Escape");
  await page.getByTestId("governance").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "off");
  expect(
    await page
      .locator('[data-slot="skeleton"]')
      .evaluate((node) => getComputedStyle(node, "::after").opacity),
  ).toBe("0");
  evidence.push("Global control and OS reduced motion preserve controls and portal state");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: resolve(output, "mobile-reduced.png"), fullPage: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.locator("html").evaluate((node) => node.classList.add("dark"));
  await page.screenshot({ path: resolve(output, "mobile-dark.png"), fullPage: true });
  expect(errors).toEqual([]);
  evidence.push("1360px + 390px, dark mode and browser runtime passed");
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify({ status: "passed", evidence }, null, 2),
  );
  console.log(JSON.stringify({ status: "passed", output, evidence }, null, 2));
} finally {
  await browser.close();
}
