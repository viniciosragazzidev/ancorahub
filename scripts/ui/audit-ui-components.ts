import fs from "node:fs";
import path from "node:path";

/** Auditoria de não regressão do design system. Use --strict para a dívida total. */

const PROJECT_ROOT = path.resolve(process.cwd());
const TARGET_DIRS = [
  path.join(PROJECT_ROOT, "src", "app"),
  path.join(PROJECT_ROOT, "src", "features"),
  path.join(PROJECT_ROOT, "src", "components"),
];

// Arquivos isentos intencionalmente (ex: download hidden form input, scripts específicos)
const EXEMPTIONS = [
  // Escopo desta fase: somente o produto CRM autenticado. Auth, Super Admin,
  // ferramentas técnicas e páginas públicas entram em ondas próprias.
  "src/app/(auth)/",
  "src/app/(platform-admin)/",
  "src/app/(dashboard)/guia/",
  "src/app/(dashboard)/roadmap/",
  "src/app/(dashboard)/settings/waha-diagnostic/",
  "src/app/global-error.tsx",
  "src/app/compartilhado/",
  "src/app/page.tsx",
  "src/components/super-admin-role-switcher.tsx",
  "src/components/application/",
  "src/components/base/",
  "src/components/motion/",
  "src/components/ui/",
  "src/components/unlumen-ui/",
  "src/components/foundations/",
  "node_modules/",
];

const BASELINE_PATH = path.join(PROJECT_ROOT, "scripts", "ui", "design-system-baseline.json");

type Violation = {
  file: string;
  line: number;
  content: string;
  rule: string;
};

function walkDir(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(filePath));
    } else if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
      results.push(filePath);
    }
  }
  return results;
}

function auditFiles(): Violation[] {
  const violations: Violation[] = [];
  const files: string[] = [];

  for (const dir of TARGET_DIRS) {
    files.push(...walkDir(dir));
  }

  for (const filePath of files) {
    const relativePath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");

    if (EXEMPTIONS.some((exempt) => relativePath.startsWith(exempt))) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    let ignoreBlock = false;
    lines.forEach((line, index) => {
      if (line.includes("ui-audit-ignore-start")) {
        ignoreBlock = true;
        return;
      }
      if (line.includes("ui-audit-ignore-end")) {
        ignoreBlock = false;
        return;
      }
      if (ignoreBlock) return;
      // Ignorar se a linha contiver ui-audit-disable-line ou for uma string de snippet
      if (line.includes("ui-audit-disable-line")) return;

      const checks: Array<[RegExp, string]> = [
        [/<button[\s>]/, "NATIVE_BUTTON"],
        [/<select[\s>]/, "NATIVE_SELECT"],
        [/<table[\s>]/, "NATIVE_TABLE"],
        [/<textarea[\s>]/, "NATIVE_TEXTAREA"],
        [/<input(?![^>]*type=[\"']hidden[\"'])[^>]*[\s>]/, "NATIVE_INPUT"],
        [/\b(?:bg|text|border|ring)-\[#[0-9a-fA-F]{3,8}\]/, "HARDCODED_COLOR"],
        [/\brounded-\[(?!var\()[^\]]+\]/, "ARBITRARY_RADIUS"],
        [/\bshadow-\[(?!var\()[^\]]+\]/, "ARBITRARY_SHADOW"],
        [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "LITERAL_EMOJI"],
      ];

      for (const [pattern, rule] of checks) {
        const inputTag = lines.slice(index, index + 6).join(" ").split(">")[0] ?? line;
        if (rule === "NATIVE_INPUT" && /type=["']hidden["']/.test(inputTag)) {
          continue;
        }
        if (pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            content: line.trim(),
            rule,
          });
        }
      }
    });
  }

  return violations;
}

const violations = auditFiles();
const counts = Object.fromEntries(
  [...new Set(violations.map((violation) => violation.rule))]
    .sort()
    .map((rule) => [rule, violations.filter((violation) => violation.rule === rule).length]),
);
const strict = process.argv.includes("--strict");
const json = process.argv.includes("--json");

if (json) {
  console.log(JSON.stringify({ counts, violations }, null, 2));
  process.exit(strict && violations.length > 0 ? 1 : 0);
}

console.log("[ui:audit] Auditoria de componentes e tokens\n");
console.table(counts);

if (strict && violations.length > 0) {
  for (const violation of violations) {
    console.log(`${violation.rule} ${violation.file}:${violation.line} ${violation.content}`);
  }
  process.exit(1);
}

const baseline = fs.existsSync(BASELINE_PATH)
  ? (JSON.parse(fs.readFileSync(BASELINE_PATH, "utf-8")) as Record<string, number>)
  : {};
const regressions = Object.entries(counts).filter(
  ([rule, count]) => count > (baseline[rule] ?? 0),
);

if (regressions.length > 0) {
  console.log("\n[ui:audit] Regressões acima do baseline:");
  for (const [rule, count] of regressions) {
    console.log(`- ${rule}: ${count} (baseline ${baseline[rule] ?? 0})`);
  }
  process.exit(1);
}

console.log("\n[ui:audit] Sem novas divergências. Use --strict para listar toda a dívida atual.");
