import { argumentValue, fileExists, readJson } from "./lib";

type Domain = { id: string; keywords: string[]; paths: string[]; documents: string[] };
type Manifest = { baseline: string[]; domains: Domain[] };

const task = (argumentValue("--task") ?? process.argv.slice(2).join(" ")).toLocaleLowerCase("pt-BR");
if (!task.trim()) {
  console.error('Uso: npm run agent:context -- --task "objetivo da tarefa"');
  process.exit(1);
}

const manifest = readJson<Manifest>(".agent/context-manifest.json");
const matches = manifest.domains.filter((domain) => domain.keywords.some((keyword) => task.includes(keyword)));
const documents = [...manifest.baseline, ...matches.flatMap((domain) => domain.documents)];
const uniqueDocuments = [...new Set(documents)];

console.log("# Contexto recomendado");
console.log(`\nTarefa: ${task}`);
console.log("\n## Nível 0");
for (const document of manifest.baseline) console.log(`- ${document}${fileExists(document) ? "" : " (AUSENTE)"}`);
console.log("\n## Módulos selecionados");
if (!matches.length) console.log("- Nenhum módulo automático; use o mapa e registre a lacuna no manifest se necessário.");
for (const domain of matches) console.log(`- ${domain.id}: ${domain.paths.join(", ")}`);
console.log("\n## Leituras adicionais");
for (const document of uniqueDocuments.filter((document) => !manifest.baseline.includes(document))) {
  console.log(`- ${document}${fileExists(document) ? "" : " (AUSENTE)"}`);
}
