import { changedFiles, fileExists, readProjectFile, requestedFiles, writeReport } from "./lib";

const files = requestedFiles();
const candidates = files.length ? files : changedFiles();
const sourceFiles = candidates.filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("src/") || file.startsWith("apps/") || file.startsWith("services/")) && fileExists(file));
const findings: string[] = [];

for (const file of sourceFiles) {
  const source = readProjectFile(file);
  if (file.startsWith("src/components/") && /from ["']@\/shared\/db/.test(source)) {
    findings.push(`Arquitetura: componente visual importa banco diretamente: ${file}`);
  }
  if (source.length > 32_000) findings.push(`Arquitetura: arquivo acima de 32 KB, avaliar extração: ${file}`);
  if (file.startsWith("src/app/") && source.includes('"use client"') && source.includes("from \"@/shared/db")) {
    findings.push(`Arquitetura: fronteira cliente não pode importar banco: ${file}`);
  }
}

const report = writeReport("verification", "Diagnóstico arquitetural", [
  `Arquivos avaliados: ${sourceFiles.length}`,
  "",
  ...(findings.length ? findings.map((finding) => `- ${finding}`) : ["- Sem achados no escopo atual."]),
]);
console.log(`Diagnóstico arquitetural: ${findings.length} achado(s). Relatório: ${report}`);
