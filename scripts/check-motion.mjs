// Trava de movimento (plano docs/implementations/active/2026-11-18-refinamento-movimento-areas.md, etapa 9).
// Conta padrões que o design system e o FEEDBACK.md proíbem e compara com a linha de base gravada em
// scripts/check-motion.baseline.json. Falha só quando algum número SOBE (catraca): o legado não trava a
// entrega, mas também não cresce. Quando um número cair, rode com --update para baixar a linha de base.
//   node scripts/check-motion.mjs            → confere
//   node scripts/check-motion.mjs --update   → regrava a linha de base com os números de hoje
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const MOTION_RULES = {
  // Bounce e elástico são proibidos (MOTION.md, "Never").
  bounce: /\banimate-bounce\b/g,
  // transition-all anima layout sem querer (refino de 21/07).
  transitionAll: /\btransition-all\b/g,
  // Card informativo não se mexe no hover; elevação só no que flutua (design-system.md, Elevation).
  hoverLift: /\bhover:-translate-y-[\w.[\]-]+|\bhover:shadow-(?!none\b)[\w/.[\]-]+/g,
  // Durações soltas do Tailwind no lugar dos tokens (--duration-*).
  rawDuration: /\bduration-(?:75|100|150|200|300|500|700|1000)\b/g,
  // Som e vibração só via useFeedback (FEEDBACK.md).
  rawFeedback: /\bnavigator\.vibrate\s*\(|\bplaySound\s*\(/g,
};

const EXTENSIONS = new Set([".tsx", ".ts", ".css"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "__snapshots__"]);
// Onde o padrão é a própria implementação ou não é tela do produto.
const ALLOW = {
  rawFeedback: [/^src\/lib\/feedback\//, /^src\/lib\/sounds\//],
};

function isTest(file) {
  return /\.test\.[cm]?[jt]sx?$/.test(file) || /\/__tests__\//.test(file);
}

export function scanMotionSource(file, source) {
  const normalized = file.replaceAll("\\", "/");
  const counts = {};
  for (const [rule, pattern] of Object.entries(MOTION_RULES)) {
    const allowed = (ALLOW[rule] ?? []).some((re) => re.test(normalized));
    counts[rule] = allowed ? 0 : [...source.matchAll(new RegExp(pattern.source, pattern.flags))].length;
  }
  return counts;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

export function compareWithBaseline(totals, baseline) {
  return Object.entries(totals)
    .filter(([rule, count]) => count > (baseline[rule] ?? 0))
    .map(([rule, count]) => ({ rule, count, baseline: baseline[rule] ?? 0 }));
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const baselinePath = path.join(root, "scripts", "check-motion.baseline.json");
  const files = (await walk(path.join(root, "src"))).filter((file) => !isTest(file));
  const totals = Object.fromEntries(Object.keys(MOTION_RULES).map((rule) => [rule, 0]));
  const offenders = {};
  for (const file of files) {
    const relative = path.relative(root, file).replaceAll("\\", "/");
    const counts = scanMotionSource(relative, await readFile(file, "utf8"));
    for (const [rule, count] of Object.entries(counts)) {
      if (!count) continue;
      totals[rule] += count;
      (offenders[rule] ??= []).push(`${relative} (${count})`);
    }
  }

  if (process.argv.includes("--update")) {
    await writeFile(baselinePath, `${JSON.stringify(totals, null, 2)}\n`);
    console.log("Linha de base de movimento regravada:", totals);
    return;
  }

  const baseline = JSON.parse(await readFile(baselinePath, "utf8").catch(() => "{}"));
  const worse = compareWithBaseline(totals, baseline);
  for (const [rule, count] of Object.entries(totals)) {
    const mark = worse.some((item) => item.rule === rule) ? "SUBIU" : "ok";
    console.log(`${mark.padEnd(5)} ${rule}: ${count} (base ${baseline[rule] ?? 0})`);
  }
  if (worse.length) {
    for (const { rule } of worse) console.log(`\n${rule}:\n  ${offenders[rule].join("\n  ")}`);
    console.error("\nMovimento piorou: troque pelos tokens (docs/design-system/MOTION.md) ou por useFeedback.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
