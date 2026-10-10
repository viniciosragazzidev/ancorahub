#!/usr/bin/env node
// Pure-Node checker for CSS Modules usage in TSX files.
// Scans all TSX files under src/ for module.css imports, collects every
// X.class, X.quoted and X["class"] usage, then verifies each used class
// name exists in the corresponding .module.css file. A class exists when
// the ".className" token appears anywhere in the CSS: plain selector,
// inside :global(...), or inside a media query.
// Output: "file:missingClass" lines. Exit 1 if anything is missing.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const SRC_DIR = resolve(process.cwd(), "src");
const problems = [];

const DQ = String.fromCharCode(34); // double quote
const SQ = String.fromCharCode(39); // single quote
const Q = "[" + DQ + SQ + "]"; // lone quote char class
const NQ = "[^" + DQ + SQ + "]"; // any non-quote char
const ID1 = "[A-Za-z_$]"; // js identifier start
const IDN = "[A-Za-z0-9_$]"; // js identifier continue
const CSSID = "[A-Za-z0-9_-]"; // css class chars
const SP = "[ ]*";

function regex(parts, flags) {
  return new RegExp(parts.join(""), flags);
}

// import X from "./x.module.css" (default binding; also * as X; optional named clause)
const IMPORT_RE = regex([
  "import" + SP + "(?:type" + "[ ]+" + ")?",
  "(?:[*]" + "[ ]+" + "as" + "[ ]+" + ")?(" + ID1 + IDN + "*)",
  "(?:" + SP + "," + SP + "[{][^}]*[}])?",
  SP + "from" + SP,
  Q + "(" + NQ + "*[.]module[.]css)" + Q,
], "g");

// usage X.foo  and  usage X["foo"]
function dottedUseRe(local) {
  return regex(["(?<![A-Za-z0-9_$.])", local, SP + "[.]" + SP, "(" + ID1 + IDN + "*)"], "g");
}
const BS = String.fromCharCode(92); // single backslash char
function bracketUseRe(local) {
  return regex([
    "(?<![A-Za-z0-9_$.])", local, SP + "[[]" + SP,
    "(" + Q + ")",
    "(" + NQ + "*)",
    BS + "1" + SP + "[]]",
  ], "g");
}

// any ".class" token in the css file
const CSS_CLASS_RE = regex(["[.](" + CSSID + "+)"], "g");

function walkTsx(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(path, out);
    else if (entry.isFile() && entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

import { join } from "node:path";

function findImports(source) {
  const bindings = [];
  for (const m of source.matchAll(IMPORT_RE)) {
    bindings.push({ local: m[1], from: m[2] });
  }
  return bindings;
}

function findUsages(source, local) {
  // Mask import statements so 'X.module.css' inside them is not
  // mistaken for a class usage (X.module).
  const body = source.replace(IMPORT_RE, (m) => " ".repeat(m.length));
  const used = new Set();
  for (const m of body.matchAll(dottedUseRe(local))) used.add(m[1]);
  for (const m of body.matchAll(bracketUseRe(local))) used.add(m[2]);
  return used;
}

function listClassesInCss(css) {
  const found = new Set();
  for (const m of css.matchAll(CSS_CLASS_RE)) found.add(m[1]);
  return found;
}

function resolveCssPath(importingFile, aliasFrom) {
  if (aliasFrom.startsWith("@/")) return resolve(SRC_DIR, aliasFrom.slice(2));
  return resolve(dirname(importingFile), aliasFrom);
}

for (const file of walkTsx(SRC_DIR)) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const { local, from } of findImports(source)) {
    const cssPath = resolveCssPath(file, from);
    let css;
    try {
      css = readFileSync(cssPath, "utf8");
    } catch {
      problems.push(relative(process.cwd(), file) + ": (css file not found: " + from + ")");
      continue;
    }
    const inCss = listClassesInCss(css);
    for (const cls of findUsages(source, local)) {
      if (!inCss.has(cls)) {
        problems.push(relative(process.cwd(), file) + ":" + cls + " (via " + from + ")");
      }
    }
  }
}

if (problems.length > 0) {
  for (const line of problems) console.log(line);
  console.log("");
  console.log(problems.length + " missing CSS module class(es) found.");
  process.exit(1);
}
console.log("OK: every CSS module class used under src/ exists in its .module.css file.");
process.exit(0);
