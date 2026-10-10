// Screenshots of a dev page (e.g. /dev/jornada?state=full) on a phone and a
// desktop viewport, to check the interface by eye before review.
//   node scripts/dev-shot.mjs <path> <outDir> [--port 3002] [--reduced]
// The dev server must be running (npx next dev --webpack -p 3002).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [route = "/dev/jornada", outDir = "tmp/shots"] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
const portIndex = process.argv.indexOf("--port");
const port = portIndex > 0 ? process.argv[portIndex + 1] : "3002";
const reduced = process.argv.includes("--reduced");
fs.mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "phone", width: 390, height: 844, deviceScaleFactor: 2 },
  { name: "desktop", width: 1280, height: 800, deviceScaleFactor: 1 },
];
const slug = route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-");

const browser = await chromium.launch();
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.deviceScaleFactor, reducedMotion: reduced ? "reduce" : "no-preference", locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle", timeout: 240_000 });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const file = path.join(outDir, `${slug}-${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${file} overflowX=${overflow}px errors=${errors.length}`);
    for (const error of errors.slice(0, 5)) console.log(`  ! ${error.slice(0, 200)}`);
    await context.close();
  }
} finally {
  await browser.close();
}
