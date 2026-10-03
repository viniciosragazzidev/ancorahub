import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { chromium, expect } from "@playwright/test";

// Real dialog/CSS with synthetic server responses. Never connects an account.
const output = resolve("reports/agent/verification/whatsapp-mobile");
await mkdir(output, { recursive: true });
const stubs = {
  "next/navigation": `export const useRouter = () => ({ refresh() {}, replace() {} });`,
  "@/components/ui/sonner": `export const toast = { info() {}, success() {}, error() {} };`,
  "@/app/(dashboard)/settings/whatsapp-actions": `
    export async function getWhatsAppConnection() { return {}; }
    export async function pollWhatsAppConnection() { return { success: true, status: "ready", providerStatus: "WORKING", phone: null, qrCode: null }; }
    export async function startWhatsAppConnection() { window.qa.starts++; return { success: true, status: "ready", sessionId: "synthetic-session" }; }
    export async function toggleWhatsAppChatAction() { window.qa.toggles++; return { success: true, active: false }; }
    export async function resetWhatsAppSessionAction() { window.qa.disconnects++; return { success: true }; }
    export async function forceDisconnectWhatsAppSession() { return { success: true }; }
  `,
};
const [js, styles] = await Promise.all([
  build({
    stdin: { contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { WhatsAppConnectDialog } from "@/components/whatsapp/whatsapp-connect-dialog";
      window.qa = { starts: 0, toggles: 0, disconnects: 0, opens: [] };
      window.open = (...args) => { window.qa.opens.push(args); return null; };
      const mode = document.body.dataset.mode;
      createRoot(document.getElementById("root")).render(<WhatsAppConnectDialog initial={{
        tenantId: "synthetic-tenant", userId: "synthetic-broker", status: mode === "ready" ? "ready" : "disconnected",
        sessionId: mode === "idle" ? null : "synthetic-session", sessionName: "synthetic-session",
        qrCode: null, connectedAt: null, chatInternoAtivo: true,
      }} />);
    `, loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, format: "iife", platform: "browser", tsconfig: "tsconfig.json",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "synthetic-actions", setup(builder) {
      builder.onResolve({ filter: /^(next\/navigation|@\/components\/ui\/sonner|@\/app\/\(dashboard\)\/settings\/whatsapp-actions)$/ }, ({ path }) => ({ path, namespace: "qa" }));
      builder.onLoad({ filter: /.*/, namespace: "qa" }, ({ path }) => ({ contents: stubs[path], loader: "js" }));
    } }],
  }),
  postcss([tailwind()]).process(await readFile("src/app/globals.css", "utf8"), { from: resolve("src/app/globals.css") }),
]);
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch { browser = await chromium.launch({ headless: true, channel: "chrome" }); }
const results = [];
try {
  for (const [width, mode] of [[390, "ready"], [390, "stale"], [390, "idle"], [1280, "ready"]]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(`<html lang="pt-BR"><body data-mode="${mode}"><div id="root"></div></body></html>`);
    await page.addStyleTag({ content: styles.css });
    await page.addScriptTag({ content: js.outputFiles[0].text });
    await page.getByRole("button", { name: mode === "ready" ? "WhatsApp conectado" : "Conectar WhatsApp", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    if (mode === "idle") {
      await expect(page.getByText("Conexão somente pelo computador")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Conectar WhatsApp", exact: true })).toBeHidden();
    } else {
      await expect(page.getByText("Conexão somente pelo computador")).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: "Desativar chat", exact: true })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Desconectar", exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: /Abrir WhatsApp/ }).click();
      expect(await page.evaluate(() => window.qa.opens)).toEqual([
        width < 768 ? ["whatsapp://send", "_self"] : ["https://web.whatsapp.com/", "_blank", "noopener,noreferrer"],
      ]);
      await dialog.getByRole("button", { name: "Desativar chat", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Ativar chat", exact: true })).toBeEnabled();
    }
    expect(await page.evaluate(() => window.qa.starts)).toBe(0);
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    await page.screenshot({ path: resolve(output, `${width}-${mode}.png`) });
    results.push({ width, mode, actions: await page.evaluate(() => window.qa), errors });
    await page.close();
  }
  await writeFile(resolve(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
