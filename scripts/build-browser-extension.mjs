import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import sharp from "sharp";
import { verificarLimites } from "./extensao-gates.mjs";

const root = new URL("../apps/browser-extension/", import.meta.url);
const distPath = fileURLToPath(new URL("./dist/", root));
const producao = process.env.NODE_ENV !== "development";
// Padrão do CRM vem de crm.json, a mesma fonte que o código usa (sem duplicar o endereço).
const crmPadrao = JSON.parse(readFileSync(fileURLToPath(new URL("./crm.json", root)), "utf8")).base;
const crmBase = normalizarCrmBase(process.env.CRM_BASE ?? crmPadrao);

// O endereço do CRM vai para o código e para o manifest (host_permissions). Só https, ou localhost em dev.
function normalizarCrmBase(valor) {
  const url = new URL(valor);
  const localDev = url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !localDev) throw new Error("CRM_BASE precisa ser https");
  if (url.pathname !== "/" || url.search || url.hash) throw new Error("CRM_BASE deve ser só a origem");
  return url.origin;
}

const comum = {
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome120",
  sourcemap: false,
  minify: producao,
  legalComments: "none",
  define: { __CRM_BASE__: JSON.stringify(crmBase) },
};
const fonte = (caminho) => fileURLToPath(new URL(caminho, root));

await rm(distPath, { recursive: true, force: true });
await mkdir(fileURLToPath(new URL("./dist/popup/", root)), { recursive: true });
await mkdir(fileURLToPath(new URL("./dist/panel/", root)), { recursive: true });
await mkdir(fileURLToPath(new URL("./dist/icons/", root)), { recursive: true });
await mkdir(fileURLToPath(new URL("./dist/offscreen/", root)), { recursive: true });

await build({ ...comum, entryPoints: [fonte("./src/background/service-worker.ts")], outfile: `${distPath}background-service-worker.js` });
await build({ ...comum, entryPoints: [fonte("./src/content/index.ts")], outfile: `${distPath}content-index.js` });
await build({ ...comum, entryPoints: [fonte("./src/popup/index.ts")], outfile: `${distPath}popup/popup.js` });
await build({ ...comum, entryPoints: [fonte("./src/background/offscreen-audio.ts")], outfile: `${distPath}offscreen/audio.js` });
// Quarta entrada: painel React em ESM. Não entra no script de conteúdo, para o bundle inicial continuar pequeno.
// O script de conteúdo carrega este arquivo com import() (recurso acessível pela web, declarado no manifest).
await build({
  ...comum,
  format: "esm",
  entryPoints: [fonte("./src/panel/main.tsx")],
  outfile: `${distPath}panel/panel.js`,
  jsx: "automatic",
  loader: { ".css": "text" },
  define: { ...comum.define, "process.env.NODE_ENV": '"production"' },
});

await cp(fonte("./src/popup/index.html"), fileURLToPath(new URL("./dist/popup/index.html", root)));
await cp(fonte("./src/background/audio.html"), fileURLToPath(new URL("./dist/offscreen/audio.html", root)));
for (const size of [16, 32, 48, 128]) {
  await sharp(fonte("./assets/notification-icon.svg"))
    .resize(size, size)
    .png()
    .toFile(`${distPath}icons/ancorahub-${size}.png`);
}
const manifest = JSON.parse(await readFile(fonte("./manifest.json"), "utf8"));
manifest.host_permissions = ["https://web.whatsapp.com/*", `${crmBase}/*`];
// Só a página de conexão do CRM pode mandar mensagem para a extensão (mesmo host do CRM_BASE, caminho fixo).
manifest.externally_connectable = { matches: [`${crmBase}/extensao/conectar*`] };
// O painel React é carregado pelo script de conteúdo no WhatsApp Web; só esse arquivo fica acessível.
manifest.web_accessible_resources = [{ resources: ["panel/panel.js"], matches: ["https://web.whatsapp.com/*"] }];
await writeFile(fileURLToPath(new URL("./dist/manifest.json", root)), `${JSON.stringify(manifest, null, 2)}\n`);

// Checagem automática dos limites (gzip, como na README). Em EXTENSION_STRICT=1 (CI) o build falha; fora dele, só avisa.
const gzipPorArquivo = Object.fromEntries(await Promise.all(["background-service-worker.js", "content-index.js", "panel/panel.js"].map(
  async (arquivo) => [arquivo, gzipSync(await readFile(`${distPath}${arquivo}`), { level: 9 }).length],
)));
const estouros = verificarLimites(gzipPorArquivo);
for (const linha of estouros) console.error(`[extensão] Acima do limite de tamanho: ${linha}`);
if (estouros.length && process.env.EXTENSION_STRICT === "1") throw new Error("Extensão acima do limite de tamanho (EXTENSION_STRICT=1).");
