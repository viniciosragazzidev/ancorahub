// Deliberately accepts no production DATABASE_URL fallback.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const root = process.env.ERP_TEST_ROOT;
if (!root) throw new Error("ERP_TEST_ROOT must name the isolated, marked PostgreSQL test folder.");
const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Missing test-only provenance marker.");
const url = new URL(process.env.ERP_TEST_DATABASE_URL || "invalid:");
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5442" || url.pathname !== "/erp_test" || url.username !== "erp_test") throw new Error("Only the isolated local erp_test database on port 5442 is permitted.");
const sql = postgres(url.toString(), { max: 1, prepare: false, onnotice: () => {} });
try {
  const [server] = await sql`SHOW data_directory`;
  const expected = path.resolve(root, "data-erp-test").replaceAll("\\", "/").toLowerCase();
  if (path.resolve(server.data_directory).replaceAll("\\", "/").toLowerCase() !== expected) throw new Error("The running server does not belong to the marked test folder.");
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const configPath = path.join(root, "drizzle-fixture.config.cjs");
  await fs.writeFile(configPath, `module.exports = ${JSON.stringify({ dialect: "postgresql", schema: path.join(repo, "src/shared/db/schema.ts").replaceAll("\\", "/"), out: "./fixture-schema" })};\n`);
  execFileSync(process.execPath, [path.join(repo, "node_modules/drizzle-kit/bin.cjs"), "generate", `--config=${configPath}`], { cwd: root, stdio: "inherit" });
  if (process.argv.includes("--reset-synthetic")) {
    await sql.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public").simple();
  }
  const [existing] = await sql`SELECT to_regclass('public.tenants') AS table_name`;
  if (existing.table_name) throw new Error("Fixture schema exists. Explicit --reset-synthetic is required to recreate it.");
  // Apply the existing search function/extensions before schema-generated indexes.
  const searchMigration = await fs.readFile(path.join(repo, "drizzle/0205_knowledge_search_indexes.sql"), "utf8");
  await sql.unsafe(searchMigration.slice(0, searchMigration.indexOf("CREATE INDEX"))).simple();
  const folder = path.join(root, "fixture-schema");
  const files = (await fs.readdir(folder)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  for (const file of files) {
    // Fixture-only: this portable distribution lacks pgvector. AI vector search is not under test.
    let ddl = (await fs.readFile(path.join(folder, file), "utf8")).replace(/\bvector(?:\(\d+\))?/g, "real[]");
    // The legacy schema declares this nullable token's unique constraint and partial index
    // under the same name. The constraint already supplies uniqueness in this fixture.
    ddl = ddl.replace(/CREATE UNIQUE INDEX "imported_spreadsheets_public_token_unique"[^\n]*\n?/g, "");
    const snapshot = JSON.parse(await fs.readFile(path.join(folder, "meta", `${file.slice(0, 4)}_snapshot.json`), "utf8"));
    for (const table of Object.values(snapshot.tables)) for (const constraint of Object.values(table.uniqueConstraints ?? {})) {
      const duplicate = table.indexes?.[constraint.name];
      if (!duplicate) continue;
      if (!duplicate.isUnique || JSON.stringify(duplicate.columns.map((column) => column.expression)) !== JSON.stringify(constraint.columns)) throw new Error(`Conflicting legacy constraint/index: ${constraint.name}`);
      ddl = ddl.split("\n").filter((line) => !line.startsWith(`CREATE UNIQUE INDEX "${constraint.name}" `)).join("\n");
    }
    // Drizzle's SQL printer truncates CHECK expressions containing a semicolon in a quoted regex.
    // Restore the exact recorded expression, only in the generated local fixture.
    for (const table of Object.values(snapshot.tables)) for (const constraint of Object.values(table.checkConstraints ?? {})) {
      if (!constraint.value.includes(";")) continue;
      const lines = ddl.split("\n");
      ddl = lines.map((line) => line.includes(`CONSTRAINT "${constraint.name}" CHECK`) ? `\tCONSTRAINT "${constraint.name}" CHECK (${constraint.value})${line.trimEnd().endsWith(",") ? "," : ""}` : line).join("\n");
    }
    await sql.unsafe(ddl).simple();
  }
  await sql.unsafe(await fs.readFile(path.join(repo, "drizzle/0230_erp_operational.sql"), "utf8")).simple();
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'`;
  console.log(JSON.stringify({ database: "erp_test", host: "127.0.0.1", port: 5442, tables: count, migration: "0230_erp_operational", vectorSearchTested: false }));
} finally { await sql.end(); }
