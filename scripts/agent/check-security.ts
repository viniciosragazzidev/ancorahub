import { changedFiles, fileExists, readProjectFile, requestedFiles, writeReport } from "./lib";

const files = requestedFiles();
const candidates = (files.length ? files : changedFiles()).filter((file) => /\.(ts|tsx)$/.test(file) && (file.startsWith("src/") || file.startsWith("apps/") || file.startsWith("services/")) && fileExists(file));
const findings: string[] = [];

for (const file of candidates) {
  const source = readProjectFile(file);
  const isBoundary = file.includes("/api/") || source.includes('"use server"') || source.includes("'use server'");
  if (isBoundary && source.includes("request.json()") && !source.includes(".parse(")) {
    findings.push(`Segurança: Route Handler com JSON sem parse de schema detectável: ${file}`);
  }
  if (isBoundary && /(?:body|formData|searchParams).*tenantId/.test(source)) {
    findings.push(`Segurança: revisar origem de tenantId em fronteira externa: ${file}`);
  }
  if (/NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|TOKEN|KEY)/.test(source)) {
    findings.push(`Segurança: possível segredo exposto por NEXT_PUBLIC: ${file}`);
  }
}

const report = writeReport("verification", "Diagnóstico de segurança", [
  `Arquivos avaliados: ${candidates.length}`,
  "",
  ...(findings.length ? findings.map((finding) => `- ${finding}`) : ["- Sem achados no escopo atual."]),
]);
console.log(`Diagnóstico de segurança: ${findings.length} achado(s). Relatório: ${report}`);
