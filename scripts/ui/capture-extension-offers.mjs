import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const output = resolve(root, "tmp/ext-ui");
const fixture = resolve(root, "apps/browser-extension/src/content/fixtures/painel-ofertas-preview.html");
const bundle = resolve(output, "panel-preview.js");
await mkdir(output, { recursive: true });
await build({
  entryPoints: [resolve(root, "apps/browser-extension/src/panel/main.tsx")],
  outfile: bundle,
  bundle: true,
  format: "iife",
  globalName: "AncoraPanel",
  target: "chrome120",
  jsx: "automatic",
  loader: { ".css": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
});

const html = await readFile(fixture, "utf8");
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  for (const tema of ["claro", "escuro"]) {
    await page.setContent(html.replace('data-theme="claro"', `data-theme="${tema}"`), { waitUntil: "domcontentloaded" });
    if (tema === "escuro") await page.locator("#wa-shell").evaluate((element) => element.classList.add("escuro"));
    await page.addScriptTag({ path: bundle });
    await page.evaluate((temaAtual) => {
      const host = document.createElement("div");
      host.id = "ancorahub-preview";
      host.style.cssText = "position:fixed;inset:0 0 0 auto;width:420px;height:100vh;z-index:20";
      const escuro = temaAtual === "escuro";
      const vars = escuro
        ? { "--ct-bg": "#111b21", "--ct-fg": "#e9edef", "--ct-muted": "#8696a0", "--ct-surface": "#202c33", "--ct-line": "#2a3942", "--ct-action": "oklch(70% .17 255)" }
        : { "--ct-bg": "#ffffff", "--ct-fg": "#111b21", "--ct-muted": "#667781", "--ct-surface": "#f0f2f5", "--ct-line": "#e9edef", "--ct-action": "oklch(62% .2 255)" };
      for (const [name, value] of Object.entries(vars)) host.style.setProperty(name, value);
      const shadow = host.attachShadow({ mode: "open" });
      document.body.append(host);
      const actions = {
        carregar: async () => ({ ok: true, ofertas: [{ id: "oferta-sintetica-01", expiresAt: new Date(Date.now() + 45_000).toISOString(), plantao: "Centro · manhã", temperatura: "quente", primeiroNome: "Cliente Exemplo", phoneMasked: "(11) 9****-0000", foraDoPlantao: false }] }),
        aceitar: async () => ({ ok: false, error: "OFFLINE", message: "Prévia" }),
        recusar: async () => ({ ok: false, error: "OFFLINE", message: "Prévia" }),
        abrirConversa: async () => ({ ok: false, reason: "PREVIEW" }), abrirReserva: () => {}, lerSom: async () => false,
        definirSom: () => {}, abrirNoCrm: () => {}, respostas: async () => [], inserir: () => {}, acao: async () => ({ ok: true }),
        conectar: () => {}, abrirNotificacoes: () => {}, tentarNovamente: () => {}, fechar: () => {},
      };
      const lead = { id: "lead-sintetico-01", version: 1, name: "Contato de teste", phoneMasked: "(11) 9****-0000", etapa: "Em atendimento", unidade: "Unidade Centro", corretor: "Corretor de teste", proximoPasso: { titulo: "Enviar cotação", prazo: "2026-11-03T16:00:00.000Z" }, temperatura: "quente", plano: "Plano Exemplo", vidas: 3, valorMensal: 218, fila: "Fila de teste", plantao: "Centro · manhã", chegouEm: "2026-11-03T12:00:00.000Z", historico: [{ tipo: "Ligação", data: "2026-11-03T13:00:00.000Z" }, { tipo: "Mensagem", data: "2026-11-02T10:00:00.000Z" }] };
      const panel = window.AncoraPanel.montarPainel(shadow, actions, { tipo: "lead", lead });
      panel.definirAberta(true);
    }, tema);
    await page.waitForFunction(() => document.querySelector("#ancorahub-preview")?.shadowRoot?.querySelector(".oferta"));
    await page.screenshot({ path: resolve(output, `ofertas-${tema}.png`), fullPage: true });
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.id = "ancorahub-notice-preview";
      host.style.cssText = "position:fixed;inset:0;z-index:30;pointer-events:none";
      const shadow = host.attachShadow({ mode: "open" });
      document.body.append(host);
      window.AncoraPanel.montarAvisoInbox(shadow, () => {}).atualizar({ id: "aviso-sintetico-01", tipo: "offer", offerId: "oferta-sintetica-01" });
    });
    await page.waitForFunction(() => document.querySelector("#ancorahub-notice-preview")?.shadowRoot?.querySelector(".aviso-inbox"));
    await page.waitForTimeout(350);
    await page.screenshot({ path: resolve(output, `aviso-${tema}.png`), fullPage: true });
  }
} finally {
  await browser.close();
}
