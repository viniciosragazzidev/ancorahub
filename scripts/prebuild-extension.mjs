import { spawnSync } from "node:child_process";
import { rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { removerTemporario } from "./limpeza-temporario.mjs";
import { decidirSaidaPrebuild } from "./extensao-gates.mjs";

// Empacotar a extensão não pode derrubar o build do Next.
// O zip é gerado num arquivo temporário e só substitui o anterior por rename (atômico no mesmo volume).
// Em qualquer falha, o zip anterior fica intacto e o script sai com 0 avisando.
// Com EXTENSION_STRICT=1 (CI), a falha sai com o código da etapa que falhou, para o pipeline parar.
const zip = fileURLToPath(new URL("../public/downloads/ancorahub-assistant.zip", import.meta.url));
const novo = `${zip}.novo`;
const estrito = process.env.EXTENSION_STRICT === "1";

// Código de saída do filho (1 se ele morreu por sinal, sem código).
function rodar(script, ambiente = {}) {
  const resultado = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url))], { stdio: "inherit", env: { ...process.env, ...ambiente } });
  return resultado.status ?? 1;
}

let publicado = false;
let codigoFalha = 0;
try {
  const statusBuild = rodar("./build-browser-extension.mjs");
  const statusZip = statusBuild === 0 ? rodar("./package-browser-extension.mjs", { ZIP_SAIDA: novo }) : statusBuild;
  codigoFalha = statusZip;
  if (statusZip === 0) {
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
process.exit(decidirSaidaPrebuild({ estrito, publicado, codigoFalha }));
