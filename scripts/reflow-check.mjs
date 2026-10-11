// WCAG 1.4.10 (reflow): the page works at 320 CSS px (= 1280px at 400% zoom,
// or a 390px phone at ~120%) without horizontal scrolling. Lists what sticks
// out that is not inside its own scroll container. Exit 1 on any overflow.
//   node scripts/reflow-check.mjs /dev/jornada /dev/equipe-placar [--port 3002]
import { chromium } from "playwright";

const portIndex = process.argv.indexOf("--port");
const port = portIndex > 0 ? process.argv[portIndex + 1] : "3002";
const routes = process.argv.slice(2).filter((arg, index, all) => !arg.startsWith("--") && all[index - 1] !== "--port");

let failed = 0;
const browser = await chromium.launch();
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 320, height: 640 }, reducedMotion: "reduce", locale: "pt-BR" });
    await page.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle", timeout: 240_000 });
    await page.waitForTimeout(700);
    const result = await page.evaluate(() => {
      const offenders = [];
      for (const element of document.querySelectorAll("body *")) {
        const rect = element.getBoundingClientRect();
        if (!rect.width || rect.right <= window.innerWidth + 1 || getComputedStyle(element).position === "fixed") continue;
        let scrolled = false;
        for (let node = element.parentElement; node; node = node.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(node).overflowX)) { scrolled = true; break; }
        }
        if (!scrolled) offenders.push(`${element.tagName.toLowerCase()}[${Math.round(rect.right)}px] ${String(element.className).slice(0, 60)}`);
      }
      return { overflow: document.documentElement.scrollWidth - window.innerWidth, offenders: offenders.slice(0, 5) };
    });
    const bad = result.overflow > 0;
    failed += bad ? 1 : 0;
    console.log(`${bad ? "FALHA" : "ok   "} ${route} rolagem lateral=${result.overflow}px`);
    for (const offender of result.offenders) console.log(`        ${offender}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
