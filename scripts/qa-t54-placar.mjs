// Fixture-only QA. API calls are blocked: this script cannot touch the database.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const out = "reports/agent/verification/T54-shots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const viewport of [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, locale: "pt-BR", timezoneId: "America/Sao_Paulo", reducedMotion: "reduce" });
    await context.route("**/api/**", (route) => route.abort());
    for (const state of ["full", "optout", "pending", "error", "success", "unavailable"]) {
      // The shared webpack server may be replacing chunks during another agent's edit.
      for (let attempt = 1; attempt <= 3; attempt++) {
      const page = await context.newPage();
      try {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
      await page.goto(`http://localhost:3002/dev-preview/placar?state=${state}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
      const control = page.getByRole("switch");
      await control.waitFor();
      if (state === "pending") await page.waitForFunction(() => document.querySelector('[role="switch"]')?.getAttribute("aria-busy") === "true");
      if (state === "error") await page.getByRole("alert").waitFor();
      if (state === "success") await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("Você saiu"));
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.waitForTimeout(1500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const rect = await control.boundingBox();
      if (overflow > 0 || !rect || rect.height < 43.99) {
        const sizing = await control.evaluate((el) => ({ minHeight: getComputedStyle(el).minHeight, rem: getComputedStyle(document.documentElement).fontSize, transform: getComputedStyle(el).transform }));
        throw new Error(`${state}: overflow=${overflow}, targetHeight=${rect?.height}, sizing=${JSON.stringify(sizing)}`);
      }
      await page.screenshot({ path: `${out}/dev-preview-placar-state-${state}-${viewport.name}.png`, fullPage: true });
      console.log(`${viewport.name}/${state}: overflow=0, target=${rect.height}px, errors=${errors.length}`);
      if (errors.length) throw new Error(errors[0]);
      break;
      } catch (error) {
        if (attempt === 3) throw error;
        console.log(`${viewport.name}/${state}: retry ${attempt} after ${String(error).split("\n")[0]}`);
        await page.waitForTimeout(4000);
      } finally { await page.close(); }
      }
    }
    await context.close();
  }
} finally { await browser.close(); }
