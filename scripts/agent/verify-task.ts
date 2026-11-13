import { execFileSync } from "node:child_process";
import { argumentValue, root, writeReport } from "./lib";

const level = argumentValue("--level") ?? "fast";
// Optional resource bounds for a local UI session; normal verification defaults are unchanged.
const testPool = argumentValue("--test-pool");
const testWorkers = argumentValue("--test-workers");
const testBail = argumentValue("--test-bail");
if (testPool && !["threads", "forks"].includes(testPool)) throw new Error("Invalid --test-pool");
for (const value of [testWorkers, testBail]) {
  if (value !== undefined && !/^[1-9]\d?$/.test(value)) throw new Error("Test bounds must be integers from 1 to 99");
}
const testOptions = [testPool && `--pool=${testPool}`, testWorkers && `--maxWorkers=${testWorkers}`, testBail && `--bail=${testBail}`].filter((value): value is string => Boolean(value));
const testCommand = testOptions.length ? `test -- ${testOptions.join(" ")}` : "test";
const commands = level === "full"
  ? ["agent:docs", "agent:changed", "agent:architecture", "agent:security", "agent:performance", "lint", "type-check", testCommand, "build"]
  : ["agent:docs", "type-check", testCommand];
const results: string[] = [];
let failed = false;

for (const command of commands) {
  try {
    if (process.platform === "win32") {
      execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", `npm run ${command}`], { cwd: root, stdio: "inherit" });
    } else {
      const args = command === testCommand && testOptions.length ? ["run", "test", "--", ...testOptions] : ["run", command];
      execFileSync("npm", args, { cwd: root, stdio: "inherit" });
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
