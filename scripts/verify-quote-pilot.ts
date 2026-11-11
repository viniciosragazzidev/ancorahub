import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { priceLives } from "../src/features/global-catalog/pilot/engine";
import type { CatalogIndex } from "../src/features/global-catalog/pilot/contracts";

async function main() {
const [folder, source, destination] = process.argv.slice(2);
const index: CatalogIndex = JSON.parse(gunzipSync(await readFile(`${folder}/index.json.gz`)).toString());
const comparisons = JSON.parse(await readFile(`${source}/simulation-validation-v4/normalized/comparisons.json`, "utf8")) as { planId: string; scenario: string; capturedAt: string; serverTotalDecimal: string; sourceCalculation: { components: { age: number; priceId: string }[] } }[];
const mismatches: unknown[] = [];
for (const example of comparisons) {
  const plan = index.plans.find(p => p.id === example.planId);
  const date = example.capturedAt.slice(0, 10);
  const lives = example.sourceCalculation.components.map((c, i) => ({ age: c.age, holder: i === 0, relationship: "" }));
  const result = plan ? priceLives(plan, lives, date) : null;
  const [whole, fraction = ""] = example.serverTotalDecimal.split(".");
  const expected = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!result || result.totalCents !== expected) mismatches.push({ scenario: example.scenario, planId: example.planId, expected, actual: result?.totalCents });
}
const report = { release: index.release, comparisons: comparisons.length, mismatches, counts: index.counts, passed: mismatches.length === 0 && comparisons.length === 5292 };
await writeFile(destination, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (!report.passed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
