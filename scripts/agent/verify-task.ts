import { execFileSync } from "node:child_process";
import { argumentValue, root, writeReport } from "./lib";

const level = argumentValue("--level") ?? "fast";
const commands = level === "full"
  ? ["agent:docs", "agent:changed", "agent:architecture", "agent:security", "agent:performance", "lint", "type-check", "test", "build"]
  : ["agent:docs", "type-check", "test"];
const results: string[] = [];
let failed = false;

for (const command of commands) {
  try {
    if (process.platform === "win32") {
      execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm run ${command}`], { cwd: root, stdio: "inherit" });
    } else {
      execFileSync("npm", ["run", command], { cwd: root, stdio: "inherit" });
    }
    results.push(`- PASSOU: \`npm run ${command}\``);
  } catch {
    results.push(`- FALHOU: \`npm run ${command}\``);
    failed = true;
    if (command !== "lint") break;
  }
}

const report = writeReport("verification", `Verificação ${level}`, [`Nível: ${level}`, "", ...results]);
console.log(`Evidência registrada em ${report}`);
if (failed) process.exit(1);
