import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const root = "http://localhost:3101/dev/carteira-corretor-lite";
const captures = [
  ["c1-carteira-360.png", "?tela=carteira", { width: 360, height: 800 }],
  ["c1-carteira-390.png", "?tela=carteira", { width: 390, height: 844 }],
  ["c1-carteira-1440.png", "?tela=carteira", { width: 1440, height: 960 }],
];

const layout = [];
for (const [file, query, viewport] of captures) {
  const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(`${root}${query}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const dimensions = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      width: innerWidth,
      height: innerHeight,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      listScrollHeight: main?.scrollHeight ?? 0,
      listViewportHeight: main?.clientHeight ?? 0,
      segmentScrollWidth: main?.querySelector('[data-slot="segmented-control"] [data-slot="segmented-control-item"]')?.parentElement?.scrollWidth ?? 0,
      segmentViewportWidth: main?.querySelector('[data-slot="segmented-control"] [data-slot="segmented-control-item"]')?.parentElement?.clientWidth ?? 0,
    };
  });
  await page.screenshot({ path: `reports/agent/carteira-corretor-lite/${file}`, fullPage: true });
  layout.push({ file, ...dimensions, noHorizontalOverflow: dimensions.documentWidth <= dimensions.width, hasVerticalListScroll: dimensions.listScrollHeight > dimensions.listViewportHeight, errors });
  if (viewport.width < 500 && dimensions.listScrollHeight > dimensions.listViewportHeight) {
    await page.locator("main").evaluate(node => node.scrollTo(0, node.scrollHeight));
    await page.waitForTimeout(100);
    await page.screenshot({ path: `reports/agent/carteira-corretor-lite/${file.replace(".png", "-fim.png")}` });
  }
  await page.close();
}

const filterPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const filterErrors = [];
filterPage.on("pageerror", error => filterErrors.push(error.message));
filterPage.on("console", message => { if (message.type() === "error") filterErrors.push(message.text()); });
await filterPage.goto(`${root}?tela=carteira`, { waitUntil: "networkidle" });
await filterPage.addStyleTag({ content: "nextjs-portal{display:none!important}" });
await filterPage.getByRole("button", { name: "Filtros" }).click();
await filterPage.getByText("Filtrar clientes").waitFor({ state: "visible" });
const filterDimensions = await filterPage.evaluate(() => {
  const main = document.querySelector("main");
  return {
    width: innerWidth,
    height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    listScrollHeight: main?.scrollHeight ?? 0,
    listViewportHeight: main?.clientHeight ?? 0,
    segmentScrollWidth: main?.querySelector('[data-slot="segmented-control"] [data-slot="segmented-control-item"]')?.parentElement?.scrollWidth ?? 0,
    segmentViewportWidth: main?.querySelector('[data-slot="segmented-control"] [data-slot="segmented-control-item"]')?.parentElement?.clientWidth ?? 0,
  };
});
await filterPage.screenshot({ path: "reports/agent/carteira-corretor-lite/c1-filtros-390.png", fullPage: true });
layout.push({ file: "c1-filtros-390.png", ...filterDimensions, noHorizontalOverflow: filterDimensions.documentWidth <= filterDimensions.width, hasVerticalListScroll: filterDimensions.listScrollHeight > filterDimensions.listViewportHeight, errors: filterErrors });
await filterPage.close();

await browser.close();
await writeFile("reports/agent/carteira-corretor-lite/c1-layout.json", `${JSON.stringify(layout, null, 2)}\n`);
console.log(JSON.stringify(layout, null, 2));
