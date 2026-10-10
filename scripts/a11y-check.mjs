// Accessibility audit (axe-core, WCAG 2.2 A/AA) of dev pages on a phone and a
// desktop viewport. Exit 1 when a serious or critical violation is found.
//   node scripts/a11y-check.mjs /dev/jornada?state=full /dev/equipe-placar [--port 3002]
// The dev server must be running.
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const routes = process.argv.slice(2).filter((arg) => !arg.startsWith("--") && arg !== process.argv[process.argv.indexOf("--port") + 1]);
const portIndex = process.argv.indexOf("--port");
const port = portIndex > 0 ? process.argv[portIndex + 1] : "3002";
const viewports = [{ name: "phone", width: 390, height: 844 }, { name: "desktop", width: 1280, height: 800 }];

let failed = 0;
const browser = await chromium.launch();
try {
  for (const route of routes) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, locale: "pt-BR", reducedMotion: "reduce" });
      await page.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle", timeout: 240_000 });
      await page.waitForTimeout(800);
      await page.addScriptTag({ path: axePath });
      const result = await page.evaluate(async () => {
        // Next's dev indicator is not part of the product.
        const run = await window.axe.run({ exclude: [["nextjs-portal"]] }, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } });
        return run.violations.map((violation) => ({ id: violation.id, impact: violation.impact, help: violation.help, nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")) }));
      });
      const serious = result.filter((item) => item.impact === "serious" || item.impact === "critical");
      failed += serious.length;
      console.log(`${route} [${viewport.name}] ${result.length} violação(ões), ${serious.length} séria(s)/crítica(s)`);
      for (const item of result) console.log(`  ${item.impact?.padEnd(9)} ${item.id}: ${item.help}\n            ${item.nodes.join(" | ")}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
