import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const registryPath = resolve(root, ".agent/pattern-registry.json");
const patternDirectory = resolve(root, "docs/design-system/patterns");
const requiredPatterns = [
  "LIST_PAGE",
  "DETAIL_PAGE",
  "SETTINGS_PAGE",
  "DASHBOARD_PAGE",
  "FORM_PAGE",
  "WIZARD_PAGE",
  "CHAT_PAGE",
  "CRM_PAGE",
  "KANBAN_PAGE",
  "ANALYTICS_PAGE",
  "AUTH_PAGE",
];

const filenameForPattern = (pattern) => pattern.toLowerCase().replaceAll("_", "-") + ".md";

let registry;
try {
  registry = JSON.parse(await readFile(registryPath, "utf8"));
} catch (error) {
  console.error("[pattern-registry] JSON inválido ou inacessível:", error.message);
  process.exit(1);
}

const errors = [];

if (registry.enforcement !== "REQUIRED_FOR_NEW_OR_REFACTORED_PAGES") {
  errors.push("enforcement deve ser REQUIRED_FOR_NEW_OR_REFACTORED_PAGES");
}

for (const pattern of requiredPatterns) {
  if (!existsSync(resolve(patternDirectory, filenameForPattern(pattern)))) {
    errors.push(`blueprint ausente: ${pattern}`);
  }
}

for (const [pattern, definition] of Object.entries(registry.patterns ?? {})) {
  if (!requiredPatterns.includes(pattern)) {
    errors.push(`pattern desconhecido no registry: ${pattern}`);
    continue;
  }

  if (!Array.isArray(definition.uses) || definition.uses.some((route) => typeof route !== "string" || !route.startsWith("/"))) {
    errors.push(`${pattern}.uses deve conter rotas absolutas`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`[pattern-registry] ${error}`);
  process.exit(1);
}

console.log(`[pattern-registry] válido: ${requiredPatterns.length} blueprints, ${Object.keys(registry.patterns).length} patterns classificados.`);
