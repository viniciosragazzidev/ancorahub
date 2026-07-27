import { build } from "esbuild";
import { mkdir, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../apps/browser-extension/", import.meta.url);
const dist = new URL("./dist/", root);
const distPath = fileURLToPath(dist);
await rm(distPath, { recursive: true, force: true });
await mkdir(distPath, { recursive: true });
const common = { bundle: true, format: "iife", platform: "browser", target: "chrome120", sourcemap: true, minify: false };
await build({ ...common, entryPoints: [fileURLToPath(new URL("./src/background/service-worker.ts", root))], outfile: `${distPath}/background-service-worker.js` });
await build({ ...common, entryPoints: [fileURLToPath(new URL("./src/content/index.ts", root))], outfile: `${distPath}/content-index.js` });
await build({ ...common, entryPoints: [fileURLToPath(new URL("./src/popup/index.ts", root))], outfile: `${distPath}/popup/popup.js` });
await mkdir(fileURLToPath(new URL("./dist/popup/", root)), { recursive: true });
await cp(fileURLToPath(new URL("./src/popup/index.html", root)), fileURLToPath(new URL("./dist/popup/index.html", root)));
await cp(fileURLToPath(new URL("./manifest.json", root)), fileURLToPath(new URL("./dist/manifest.json", root)));
