#!/usr/bin/env node

/**
 * check-encoding.mjs
 *
 * Escaneia recursivamente arquivos-fonte em busca de caracteres mojibake
 * (UTF-8 corrompido), ex: "Cotações" em vez de "Cotações".
 *
 * Uso:
 *   node scripts/check-encoding.mjs
 *   node scripts/check-encoding.mjs --fix
 *   node scripts/check-encoding.mjs --ext=.ts,.tsx
 *
 * Nota: os caracteres corrompidos nos padrões usam escapes Unicode (\uXXXX)
 * para que o modo --fix nunca danifique o próprio script.
 */

import { readFileSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Padrões mojibake comuns ──────────────────────────────────────────────────
// Bytes UTF-8 de caracteres acentuados latinos interpretados como Latin-1.
// Usamos \uXXXX para garantir que o --fix não danifique estas strings.
const MOJIBAKE_PATTERNS = [
  // Acentos portugueses comuns
  { corrupted: "\u00C3\u00A7", correct: "\u00E7" },   // ç → ç
  { corrupted: "\u00C3\u00B5", correct: "\u00F5" },   // õ → õ
  { corrupted: "\u00C3\u00A3", correct: "\u00E3" },   // ã → ã
  { corrupted: "\u00C3\u00AD", correct: "\u00ED" },   // í → í
  { corrupted: "\u00C3\u00A1", correct: "\u00E1" },   // á → á
  { corrupted: "\u00C3\u00A9", correct: "\u00E9" },   // é → é
  { corrupted: "\u00C3\u00AA", correct: "\u00EA" },   // ê → ê
  { corrupted: "\u00C3\u00BA", correct: "\u00FA" },   // ú → ú
  { corrupted: "\u00C3\u00A2", correct: "\u00E2" },   // â → â
  { corrupted: "\u00C3\u00B4", correct: "\u00F4" },   // ô → ô
  { corrupted: "\u00C3\u00B3", correct: "\u00F3" },   // ó → ó
  { corrupted: "\u00C3\u00B1", correct: "\u00F1" },   // ñ → ñ
  // Símbolos (byte único C2 + algo)
  { corrupted: "\u00C2\u00A7", correct: "\u00A7" },   // § → §
  { corrupted: "\u00C2\u00BA", correct: "\u00BA" },   // º → º
  // Símbolos multi-byte (e2 80 + algo)
  { corrupted: "\u00E2\u0080\u0094", correct: "\u2014" }, // â€” → —
  { corrupted: "\u00E2\u0080\u0093", correct: "\u2013" }, // â€“ → –
  { corrupted: "\u00E2\u0080\u00A2", correct: "\u2022" }, // â€¢ → •
  { corrupted: "\u00E2\u0080\u0099", correct: "\u2019" }, // â€™ → '
  { corrupted: "\u00E2\u0080\u009C", correct: "\u201C" }, // â€œ → "
  { corrupted: "\u00E2\u0080\u009D", correct: "\u201D" }, // â€  → "
];

// Regex combinado (case-sensitive)
const combinedRegex = new RegExp(
  MOJIBAKE_PATTERNS.map((p) => p.corrupted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g",
);

const DEFAULT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".css", ".html",
  ".md", ".mdx", ".sql", ".yml", ".yaml",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".next", "out", "build", "dist", ".git", ".vercel",
  ".data", "coverage", ".firecrawl",
]);

// ─── Walk recursivo ───────────────────────────────────────────────────────────
function walkDir(dir, extensions, ignoreDirs) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name) && !entry.name.startsWith(".")) {
        files.push(...walkDir(fullPath, extensions, ignoreDirs));
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (extensions.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes("--fix");
  const verbose = args.includes("--verbose");
  const customExts = args
    .find((a) => a.startsWith("--ext="))
    ?.replace("--ext=", "")
    .split(",")
    .filter(Boolean);

  const extensions = customExts ? new Set(customExts) : DEFAULT_EXTENSIONS;

  console.error("\uD83D\uDD0D Escaneando arquivos (" + [...extensions].join(", ") + ")...");

  const files = walkDir(ROOT, extensions, IGNORE_DIRS);
  let totalIssues = 0;
  let totalFiles = 0;
  const fixInfo = { files: 0, occurrences: 0 };

  for (const filePath of files) {
    // Pular arquivos grandes (>500KB)
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      continue;
    }
    if (stat.size > 500_000) continue;

    let content;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    combinedRegex.lastIndex = 0;
    const matches = [...content.matchAll(combinedRegex)];
    if (matches.length === 0) continue;

    totalFiles++;
    const relPath = relative(ROOT, filePath);
    const fileDisplay = "\u001B[31m\u274C " + relPath + "\u001B[0m (" + matches.length + " ocorr\u00EAncia(s))";
    console.error("\n" + fileDisplay);

    for (const match of matches) {
      const lineNumber = content.slice(0, match.index).split("\n").length;
      const hint = MOJIBAKE_PATTERNS.find((p) => p.corrupted === match[0]);
      const suggestion = hint ? " \u2192 \"" + hint.correct + "\"" : "";
      const ctxStart = Math.max(0, match.index - 25);
      const ctxEnd = Math.min(content.length, match.index + match[0].length + 25);
      const context = content.slice(ctxStart, ctxEnd).replace(/\n/g, "\u21B5");
      console.error("  \u001B[33m  Linha " + lineNumber + ":\u001B[0m \"" + match[0] + "\"" + suggestion);
      if (verbose) {
        console.error("    Contexto: \u2026" + context + "\u2026");
      }
    }

    totalIssues += matches.length;

    // ─── Modo --fix ────────────────────────────────────────────────────────
    if (shouldFix) {
      let fixed = content;
      for (const { corrupted, correct } of MOJIBAKE_PATTERNS) {
        fixed = fixed.replaceAll(corrupted, correct);
      }
      if (fixed !== content) {
        writeFileSync(filePath, fixed, "utf-8");
        fixInfo.files++;
        fixInfo.occurrences += matches.length;
      }
    }
  }

  // ─── Resumo ─────────────────────────────────────────────────────────────
  if (totalIssues === 0) {
    const msg = "\n\u001B[32m\u2705 Nenhum caractere mojibake encontrado em " + files.length + " arquivos escaneados.\u001B[0m";
    console.error(msg);
    process.exit(0);
  } else {
    const summary = "\n\u001B[31m\u26A0\uFE0F  " + totalIssues + " ocorr\u00EAncia(s) mojibake em " + totalFiles + " arquivo(s) (de " + files.length + " escaneados).\u001B[0m";
    console.error(summary);
    if (shouldFix) {
      const fixed = "\u001B[32m  \u2192 " + fixInfo.files + " arquivo(s) corrigido(s), " + fixInfo.occurrences + " ocorr\u00EAncia(s) ajustada(s).\u001B[0m";
      console.error(fixed);
    } else {
      console.error("  Use \u001B[36m--fix\u001B[0m para corrigir automaticamente.");
      console.error("  Execute: \u001B[36mnode scripts/check-encoding.mjs --fix\u001B[0m");
    }
    process.exit(1);
  }
}

main();
