import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const root = "http://localhost:3101/dev/carteira-corretor-lite";
const captures = [
  ["c0-carteira-390.png", "?tela=carteira", { width: 390, height: 844 }],
  ["c0-carteira-1440.png", "?tela=carteira", { width: 1440, height: 960 }],
  ["c0-ficha-390.png", "?tela=ficha", { width: 390, height: 844 }],
  ["c0-retorno-390.png", "?tela=retorno", { width: 390, height: 844 }],
  ["c0-estados-390.png", "?tela=estados", { width: 390, height: 1000 }],
  ["c0-estados-1440.png", "?tela=estados", { width: 1440, height: 960 }],
];

for (const [file, query, viewport] of captures) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  await page.goto(`${root}${query}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.screenshot({ path: `reports/agent/carteira-corretor-lite/${file}`, fullPage: true });
  await page.close();
}

await browser.close();
