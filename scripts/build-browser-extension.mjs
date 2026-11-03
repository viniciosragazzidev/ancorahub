import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../apps/browser-extension/", import.meta.url);
const distPath = fileURLToPath(new URL("./dist/", root));
const producao = process.env.NODE_ENV !== "development";
const crmBase = normalizarCrmBase(process.env.CRM_BASE ?? "https://crm.ancorasaude.cloud");

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

await build({ ...comum, entryPoints: [fonte("./src/background/service-worker.ts")], outfile: `${distPath}background-service-worker.js` });
await build({ ...comum, entryPoints: [fonte("./src/content/index.ts")], outfile: `${distPath}content-index.js` });
await build({ ...comum, entryPoints: [fonte("./src/popup/index.ts")], outfile: `${distPath}popup/popup.js` });
// Quarta entrada: painel React. Não entra no script de conteúdo, para o bundle inicial continuar pequeno.
await build({
  ...comum,
  entryPoints: [fonte("./src/panel/main.tsx")],
  outfile: `${distPath}panel/panel.js`,
  jsx: "automatic",
  loader: { ".css": "text" },
  define: { ...comum.define, "process.env.NODE_ENV": '"production"' },
});

await cp(fonte("./src/popup/index.html"), fileURLToPath(new URL("./dist/popup/index.html", root)));
const manifest = JSON.parse(await readFile(fonte("./manifest.json"), "utf8"));
manifest.host_permissions = ["https://web.whatsapp.com/*", `${crmBase}/*`];
await writeFile(fileURLToPath(new URL("./dist/manifest.json", root)), `${JSON.stringify(manifest, null, 2)}\n`);
