import { changedFiles, fileExists, readProjectFile, requestedFiles, writeReport } from "./lib";

const files = requestedFiles();
const candidates = (files.length ? files : changedFiles()).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("src/") || file.startsWith("apps/") || file.startsWith("services/")) && fileExists(file));
const findings: string[] = [];

for (const file of candidates) {
  const source = readProjectFile(file);
  if (source.length > 32_000) findings.push(`Desempenho: arquivo grande (${Math.ceil(source.length / 1024)} KB): ${file}`);
  if (source.includes('"use client"') && source.length > 16_000) {
    findings.push(`Desempenho: componente cliente grande, revisar fronteiras RSC: ${file}`);
  }
  if (source.includes("setInterval(") && !source.includes("clearInterval(")) {
    findings.push(`Desempenho: intervalo sem limpeza detectável: ${file}`);
  }
}

const report = writeReport("verification", "Diagnóstico de desempenho", [
  `Arquivos avaliados: ${candidates.length}`,
  "",
  ...(findings.length ? findings.map((finding) => `- ${finding}`) : ["- Sem achados no escopo atual."]),
]);
console.log(`Diagnóstico de desempenho: ${findings.length} achado(s). Relatório: ${report}`);
