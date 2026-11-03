import { spawnSync } from "node:child_process";
import { rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { removerTemporario } from "./limpeza-temporario.mjs";

// Empacotar a extensão não pode derrubar o build do Next.
// O zip é gerado num arquivo temporário e só substitui o anterior por rename (atômico no mesmo volume).
// Em qualquer falha, o zip anterior fica intacto e o script sai com 0 avisando.
const zip = fileURLToPath(new URL("../public/downloads/ancorahub-assistant.zip", import.meta.url));
const novo = `${zip}.novo`;

function rodar(script, ambiente = {}) {
  const resultado = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { stdio: "inherit", env: { ...process.env, ...ambiente } });
  return resultado.status === 0;
}

let publicado = false;
try {
  const geradoOk = rodar("./build-browser-extension.mjs") && rodar("./package-browser-extension.mjs", { ZIP_SAIDA: novo });
  if (geradoOk) {
    await rename(novo, zip);
    // Só agora o zip novo está publicado.
    publicado = true;
  }
} catch (erro) {
  console.warn("[extensão] Erro ao publicar o zip:", erro?.message ?? erro);
} finally {
  await removerTemporario(novo, (caminho) => rm(caminho, { force: true }));
}

if (!publicado) {
  console.warn("[extensão] Falhou ao gerar o zip. Mantido o zip anterior (ou sem download, se não havia); o build do site segue.");
}
process.exit(0);
