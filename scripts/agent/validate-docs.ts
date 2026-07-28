import { fileExists, readJson } from "./lib";

type Config = { requiredContext: string[] };
type Manifest = { baseline: string[]; domains: Array<{ id: string; documents: string[] }> };

const config = readJson<Config>(".agent/config.json");
const manifest = readJson<Manifest>(".agent/context-manifest.json");
const required = [
  ...config.requiredContext,
  "docs/agent/README.md",
  "docs/agent/SECURITY_RULES.md",
  "docs/agent/TESTING_STRATEGY.md",
  "docs/agent/KNOWN_ISSUES.md",
  ...manifest.baseline,
  ...manifest.domains.flatMap((domain) => domain.documents),
];
const missing = [...new Set(required)].filter((file) => !fileExists(file));
if (missing.length) {
  console.error(`Documentação obrigatória ausente:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}
console.log(`Harness documental válido: ${new Set(required).size} referências verificadas.`);
