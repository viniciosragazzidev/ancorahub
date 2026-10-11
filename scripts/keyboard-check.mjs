// Keyboard pass (plan §5, E13): Tab through a page and check every stop has a
// visible focus indicator, an accessible name and a 44px target (24px minimum
// for inline links, WCAG 2.5.8), and that Tab never gets stuck.
//   node scripts/keyboard-check.mjs /dev/jornada?state=full [--port 3002] [--max 60]
import { chromium } from "playwright";

const flag = (name, fallback) => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : fallback; };
const port = flag("--port", "3002");
const max = Number(flag("--max", "60"));
const routes = process.argv.slice(2).filter((arg, index, all) => !arg.startsWith("--") && !["--port", "--max"].includes(all[index - 1]));

let problems = 0;
const browser = await chromium.launch();
try {
  for (const route of routes) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    await page.goto(`http://localhost:${port}${route}`, { waitUntil: "networkidle", timeout: 240_000 });
    await page.waitForTimeout(600);
    // Start right before the first focusable of the page; Next's dev indicator (outside <main>)
    // marks the end of the round.
    await page.evaluate(() => {
      const first = document.querySelector("main") ?? document.body;
      const anchor = document.createElement("span");
      anchor.tabIndex = -1;
      first.prepend(anchor);
      anchor.focus();
    });
    const seen = new Set();
    const issues = [];
    const advice = [];
    let stops = 0;
    for (let i = 0; i < max; i += 1) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        // Next's dev indicator is not part of the product.
        if (el.tagName === "NEXTJS-PORTAL" || el.closest("nextjs-portal")) return { end: true };
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ");
        const labelledBy = el.getAttribute("aria-labelledby");
        const hasLabel = Boolean(name || (labelledBy && document.getElementById(labelledBy)?.textContent?.trim()) || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest("label"));
        const visibleFocus = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) || (style.boxShadow && style.boxShadow !== "none") || el.matches(":focus-visible") && style.outlineStyle !== "none";
        const inline = el.tagName === "A" && style.display === "inline";
        return { key: `${el.tagName}|${name.slice(0, 40)}|${Math.round(rect.x)}|${Math.round(rect.y)}`, label: `${el.tagName.toLowerCase()} "${name.slice(0, 40)}"`, hasLabel, visibleFocus, tiny: Math.min(rect.width, rect.height) < 24, small: !inline && Math.min(rect.width, rect.height) < 44, size: `${Math.round(rect.width)}x${Math.round(rect.height)}` };
      });
      if (!info) continue;
      if (info.end) break;
      if (seen.has(info.key)) break; // wrapped around: the whole page was reached
      seen.add(info.key);
      stops += 1;
      if (!info.hasLabel) issues.push(`sem nome: ${info.label}`);
      if (!info.visibleFocus) issues.push(`foco invisível: ${info.label}`);
      if (info.tiny) issues.push(`alvo abaixo de 24px, falha WCAG 2.5.8 (${info.size}): ${info.label}`);
      else if (info.small) advice.push(`abaixo de 44px, recomendado (${info.size}): ${info.label}`);
    }
    problems += issues.length;
    console.log(`${issues.length ? "FALHA  " : "ok     "} ${route} ${stops} paradas de Tab, ${issues.length} falha(s), ${advice.length} recomendação(ões)`);
    for (const issue of issues.slice(0, 12)) console.log(`          ${issue}`);
    if (process.argv.includes("--advice")) for (const item of advice.slice(0, 12)) console.log(`          ${item}`);
    await page.close();
  }
} finally {
  await browser.close();
}
process.exit(problems ? 1 : 0);
