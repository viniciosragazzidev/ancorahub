import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const root = resolve(__dirname, "../..");

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(root, file), "utf8")) as T;
}

export function fileExists(file: string) {
  return existsSync(resolve(root, file));
}

export function listFiles(directory: string, predicate: (file: string) => boolean): string[] {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];
  const result: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current)) {
      const target = join(current, entry);
      if (statSync(target).isDirectory()) visit(target);
      else if (predicate(target)) result.push(relative(root, target).replaceAll("\\", "/"));
    }
  };
  visit(absolute);
  return result;
}

export function changedFiles(base = "HEAD"): string[] {
  try {
    const tracked = execFileSync("git", ["diff", "--name-only", base], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" })
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set([...tracked, ...untracked])];
  } catch {
    return [];
  }
}

export function readProjectFile(file: string) {
  return readFileSync(resolve(root, file), "utf8");
}

export function writeReport(kind: string, title: string, lines: string[]) {
  const target = resolve(root, "reports/agent", kind, `${new Date().toISOString().replaceAll(":", "-")}.md`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `# ${title}\n\n${lines.join("\n")}\n`, "utf8");
  return relative(root, target).replaceAll("\\", "/");
}

export function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function requestedFiles() {
  const values = process.argv.filter((value) => value.startsWith("--files="));
  return values.flatMap((value) => value.slice("--files=".length).split(",")).filter(Boolean);
}
