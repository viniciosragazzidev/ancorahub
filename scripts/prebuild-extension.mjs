import { spawnSync } from "node:child_process";
import { access, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Empacotar a extensão não pode derrubar o build do Next. Em falha, o zip anterior continua no lugar.
const zip = fileURLToPath(new URL("../public/downloads/ancorahub-assistant.zip", import.meta.url));
const copia = `${zip}.anterior`;

const existe = async (caminho) => access(caminho).then(() => true, () => false);

function rodar(script) {
  const resultado = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { stdio: "inherit" });
  return resultado.status === 0;
}

const temAnterior = await existe(zip);
if (temAnterior) await copyFile(zip, copia);

if (rodar("./build-browser-extension.mjs") && rodar("./package-browser-extension.mjs")) {
  await rm(copia, { force: true });
  process.exit(0);
}

if (temAnterior) await copyFile(copia, zip);
else await rm(zip, { force: true });
await rm(copia, { force: true });
console.warn(
  temAnterior
    ? "[extensão] Falhou ao gerar o zip. Mantido o zip anterior; o build do site segue."
    : "[extensão] Falhou ao gerar o zip e não havia um anterior; o build do site segue sem o download.",
);
process.exit(0);
