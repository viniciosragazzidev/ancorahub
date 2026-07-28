import { argumentValue, changedFiles, writeReport } from "./lib";

const files = changedFiles(argumentValue("--base") ?? "HEAD");
const prohibited = files.filter((file) => file.includes(".env") || file.startsWith("reports/agent/"));
const report = writeReport("verification", "Arquivos alterados", [
  `Base: \`${argumentValue("--base") ?? "HEAD"}\``,
  `Arquivos: ${files.length}`,
  "",
  ...files.map((file) => `- ${file}`),
]);
if (prohibited.length) {
  console.error(`Arquivos que não devem entrar no escopo versionado:\n${prohibited.map((file) => `- ${file}`).join("\n")}`);
  process.exit(1);
}
console.log(`Escopo registrado em ${report}`);
