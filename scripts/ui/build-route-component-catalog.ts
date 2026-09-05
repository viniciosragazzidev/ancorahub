import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const appRoot = path.join(sourceRoot, "app");
const outputPath = path.join(root, "docs", "ux", "audits", "ROUTE_COMPONENT_CATALOG.json");
const extensions = [".tsx", ".ts", ".jsx", ".js"];

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function resolveModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const raw = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    ...extensions.map((extension) => `${raw}${extension}`),
    ...extensions.map((extension) => path.join(raw, `index${extension}`)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function dependencies(entryFile: string): string[] {
  const visited = new Set<string>();
  const queue = [entryFile];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const source = fs.readFileSync(current, "utf-8");
    const imports = source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g);
    for (const match of imports) {
      const resolved = resolveModule(current, match[1]);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return [...visited];
}

function routeFromPage(file: string): string {
  const relative = path.relative(appRoot, path.dirname(file)).replace(/\\/g, "/");
  const visibleSegments = relative
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("));
  return `/${visibleSegments.join("/")}`.replace(/\/$/, "") || "/";
}

const componentMatchers = {
  button: /@\/components\/ui\/button/,
  card: /@\/components\/ui\/card/,
  dataTable: /@\/components\/(?:ui\/)?data-table/,
  field: /@\/components\/ui\/(?:field|form|input|select|textarea|checkbox|switch)/,
  foundation: /@\/components\/foundations/,
  overlay: /@\/components\/(?:ui\/(?:dialog|drawer|sheet|popover)|foundations\/(?:confirm-dialog|detail-drawer))/,
  tabs: /@\/components\/(?:ui\/tabs|foundations\/page-tabs)/,
} as const;

const pages = walk(appRoot).filter((file) => file.endsWith(`${path.sep}page.tsx`));
const catalog = pages
  .map((page) => {
    const files = dependencies(page);
    const productFiles = files.filter((file) => {
      const relative = path.relative(root, file).replace(/\\/g, "/");
      return relative.startsWith("src/app/") || relative.startsWith("src/features/");
    });
    const sources = productFiles.map((file) => fs.readFileSync(file, "utf-8"));
    const joined = sources.join("\n");
    const primitives = Object.fromEntries(
      Object.entries(componentMatchers).map(([name, matcher]) => [
        name,
        sources.filter((source) => matcher.test(source)).length,
      ]),
    );
    return {
      route: routeFromPage(page),
      entry: path.relative(root, page).replace(/\\/g, "/"),
      reachableProductFiles: productFiles.length,
      primitives,
      deviations: {
        nativeButton: (joined.match(/<button[\s>]/g) ?? []).length,
        nativeInput: (joined.match(/<input[\s>]/g) ?? []).length,
        nativeSelect: (joined.match(/<select[\s>]/g) ?? []).length,
        nativeTable: (joined.match(/<table[\s>]/g) ?? []).length,
        nativeTextarea: (joined.match(/<textarea[\s>]/g) ?? []).length,
        hardcodedColor: (joined.match(/\b(?:bg|text|border|ring)-\[#[0-9a-fA-F]{3,8}\]/g) ?? []).length,
        arbitraryRadius: (joined.match(/\brounded-\[(?!var\()[^\]]+\]/g) ?? []).length,
      },
    };
  })
  .sort((left, right) => left.route.localeCompare(right.route));

const result = {
  schemaVersion: 1,
  scope: "Every src/app/**/page.tsx and its local transitive product imports",
  routes: catalog,
};

if (process.argv.includes("--write")) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf-8");
  console.log(path.relative(root, outputPath).replace(/\\/g, "/"));
} else {
  console.log(JSON.stringify(result, null, 2));
}
