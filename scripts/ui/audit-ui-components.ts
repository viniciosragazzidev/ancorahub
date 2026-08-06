import fs from "node:fs";
import path from "node:path";

/**
 * Script de Auditoria Automatizada do Design System
 * Verifica se existem elementos HTML nativos (<select>) ou controles brutos fora das pastas autorizadas.
 */

const PROJECT_ROOT = path.resolve(process.cwd());
const TARGET_DIRS = [
  path.join(PROJECT_ROOT, "src", "app"),
  path.join(PROJECT_ROOT, "src", "features"),
];

// Arquivos isentos intencionalmente (ex: download hidden form input, scripts específicos)
const EXEMPTIONS = [
  "src/components/ui/",
  "src/components/unlumen-ui/",
  "node_modules/",
];

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

    lines.forEach((line, index) => {
      // Ignorar se a linha contiver ui-audit-disable-line ou for uma string de snippet
      if (line.includes("ui-audit-disable-line")) return;

      // Regra 1: Detectar <select nativo
      if (/<select[\s>]/.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          content: line.trim(),
          rule: "NATIVE_SELECT: Use o componente AppSelect em '@/components/ui/select' em vez de <select> nativo.",
        });
      }
    });
  }

  return violations;
}

console.log("🔍 [ui:audit] Iniciando auditoria de conformidade de componentes UI...\n");
const violations = auditFiles();

if (violations.length > 0) {
  console.log(`⚠️ [ui:audit] Encontradas ${violations.length} violações de padronização visual:\n`);
  for (const v of violations) {
    console.log(`❌ ${v.file}:${v.line}`);
    console.log(`   Conteúdo: ${v.content}`);
    console.log(`   Regra: ${v.rule}\n`);
  }
  console.log("ℹ️  Execute a migração para os componentes compartilhados em src/components/ui/.\n");
  process.exit(1);
} else {
  console.log("✅ [ui:audit] Sucesso! Nenhum controle nativo desalinhado foi encontrado.");
  process.exit(0);
}
