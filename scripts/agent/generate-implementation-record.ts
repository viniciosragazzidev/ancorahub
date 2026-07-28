import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argumentValue, root } from "./lib";

const slug = argumentValue("--slug");
const title = argumentValue("--title");
if (!slug || !title) {
  console.error('Uso: npm run agent:record -- --slug nome-da-tarefa --title "Título da tarefa"');
  process.exit(1);
}

const template = readFileSync(resolve(root, ".agent/templates/implementation-record.md"), "utf8");
const date = new Date().toISOString().slice(0, 10);
const target = resolve(root, `docs/implementations/active/${date}-${slug}.md`);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, template
  .replace("{{title}}", title)
  .replace("{{objective}}", "Descreva o resultado observável e o critério de aceite.")
  .replace("{{scope}}", "Liste arquivos e fluxos autorizados.")
  .replace("{{decisions}}", "Liste decisões consultadas ou declare que não houve decisão nova.")
  .replace("{{validations}}", "Registre comandos executados e resultados.")
  .replace("{{rollback}}", "Descreva como reverter sem perda de dados."), "utf8");
console.log(`Registro criado: ${target}`);
