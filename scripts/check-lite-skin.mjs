import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FILE_EXTENSIONS = new Set([".tsx", ".css"]);
const RULES = {
  gradients: /\bbg-gradient-to-[\w-]+\b|\b(?:from|via|to)-[\w/.[\]%-]+|linear-gradient\s*\(/gi,
  shadows: /\bshadow(?:-[\w/.[\]%-]+)?\b|box-shadow\s*:/gi,
  darkClasses: /\bdark:/gi,
  uppercase: /\buppercase\b/gi,
  wideTracking: /\btracking-(?:wide|wider|widest)\b/gi,
  rawColors: /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\s*\(|\b(?:bg|text|border|ring|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:\d{2,3}|subtle|dark)\b/gi,
  arbitraryValues: /\b(?:text|w|rounded)-\[[^\]]+\]/gi,
  smallTargets: /\bh-(?:7|8|9)\b|\bsize-(?:7|8|9|sm|icon)\b|\bsize=["'](?:sm|icon)["']/gi,
  forbiddenWeights: /\bfont-(?:thin|extralight|light|extrabold|black)\b|font-weight\s*:\s*(?:100|200|300|800|900)\b/gi,
  icons: /from\s+["'](?:lucide-react|@phosphor-icons\/react|@remixicon\/react|react-icons(?:\/[^"']+)?|@iconify\/[^"']+|@\/components\/huge-icons)["']/gi,
  charts: /from\s+["'](?:recharts|@\/components\/ui\/chart)["']/gi,
  uiImports: /from\s+["']@\/components\/ui\/([a-z0-9-]+)["']/gi,
  arcImports: /from\s+["']@\/components\/arc(?:\/[^"']+)?["']/gi,
  emDashText: /—/g,
};

function countMatches(source, pattern) {
  return [...source.matchAll(new RegExp(pattern.source, pattern.flags))].length;
}

export function scanLiteSkinSource(file, source) {
  const counts = Object.fromEntries(Object.entries(RULES).map(([category, pattern]) => [category, countMatches(source, pattern)]));
  const uiImports = new Set([...source.matchAll(RULES.uiImports)].map((match) => match[1]));
  return { file: file.replaceAll("\\", "/"), counts, uiImports: [...uiImports], total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

async function walk(directory, skip = new Set()) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const found = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) found.push(...await walk(absolute));
    } else if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      found.push(absolute);
    }
  }
  return found;
}

export function groupLiteSkinFile(file) {
  const normalized = file.replaceAll("\\", "/");
  if (normalized.startsWith("src/app/(dashboard)/")) {
    const route = normalized.slice("src/app/(dashboard)/".length).split("/")
      .filter((segment) => !/^\(.*\)$/.test(segment) && !segment.startsWith("@"))
      .filter((segment) => !/\.(?:tsx|css)$/.test(segment));
    return `rota:/${route.join("/")}`;
  }
  if (normalized.startsWith("src/features/")) {
    const feature = normalized.slice("src/features/".length).split("/")[0];
    return `feature:${feature}`;
  }
  const component = normalized.startsWith("src/components/")
    ? normalized.slice("src/components/".length).split("/")[0]
    : "root";
  return `componente:${component}`;
}

export async function scanLiteSkinWorkspace(root = process.cwd()) {
  const sourceFiles = [];
  sourceFiles.push(...await walk(path.join(root, "src/app/(dashboard)")));
  const featureRoot = path.join(root, "src/features");
  for (const entry of await readdir(featureRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory()) continue;
    sourceFiles.push(...await walk(path.join(featureRoot, entry.name, "components")));
  }
  sourceFiles.push(...await walk(path.join(root, "src/components"), new Set(["arc", "light", "chat"])));

  const results = await Promise.all(sourceFiles.map(async (absolute) => {
    const source = await readFile(absolute, "utf8");
    const relativeFile = path.relative(root, absolute);
    const result = scanLiteSkinSource(relativeFile, source);
    return { ...result, group: groupLiteSkinFile(relativeFile) };
  }));

  const totals = Object.fromEntries(Object.keys(RULES).map((category) => [category, 0]));
  const groups = new Map();
  const uiUsage = new Map();
  for (const result of results) {
    for (const [category, count] of Object.entries(result.counts)) totals[category] += count;
    const current = groups.get(result.group) ?? { files: 0, deviations: 0 };
    current.files += 1;
    current.deviations += result.total;
    groups.set(result.group, current);
    for (const component of result.uiImports) {
      const importers = uiUsage.get(component) ?? new Set();
      importers.add(result.file);
      uiUsage.set(component, importers);
    }
  }

  return {
    filesScanned: results.length,
    totals,
    topFiles: results.filter((result) => result.total > 0).sort((a, b) => b.total - a.total || a.file.localeCompare(b.file)).slice(0, 60),
    groups: [...groups].map(([name, counts]) => ({ name, ...counts })).sort((a, b) => b.deviations - a.deviations || a.name.localeCompare(b.name)),
    uiUsage: [...uiUsage].map(([component, files]) => ({ component, files: files.size })).sort((a, b) => b.files - a.files || a.component.localeCompare(b.component)),
  };
}

export function formatLiteSkinReport(report) {
  const lines = ["Auditoria de estilo Lite, modo relatório", `Arquivos analisados: ${report.filesScanned}`, "", "Totais por categoria:"];
  for (const [category, count] of Object.entries(report.totals)) lines.push(`- ${category}: ${count}`);
  lines.push("", "Top arquivos por desvio:");
  for (const file of report.topFiles) lines.push(`- ${file.file}: ${file.total}`);
  lines.push("", "Por rota ou feature:");
  for (const group of report.groups) lines.push(`- ${group.name}: ${group.deviations} ocorrências em ${group.files} arquivos`);
  lines.push("", "Importadores de componentes UI:");
  for (const item of report.uiUsage) lines.push(`- ${item.component}: ${item.files} arquivos`);
  return `${lines.join("\n")}\n`;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const report = await scanLiteSkinWorkspace();
  process.stdout.write(formatLiteSkinReport(report));
}
