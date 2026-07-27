import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

// Preserve variables injected by Vercel/CI. Only load local env files when the
// process was started without a database connection configured.
if (!process.env.SUPABASE_DB_URL && !process.env.DATABASE_URL) {
  loadEnvConfig(process.cwd());
}

type Journal = {
  entries: Array<{ tag: string; when: number }>;
};

const databaseUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error("SUPABASE_DB_URL or DATABASE_URL is required to apply migrations.");
}

async function main() {
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    connect_timeout: 15,
  });

  try {
    await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
    await client`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `;

    const journal = JSON.parse(
      await readFile(path.join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf8"),
    ) as Journal;
    const appliedRows = await client<{ hash: string }[]>`
      SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id
    `;
    const applied = new Set(appliedRows.map((row) => row.hash));

    for (const entry of journal.entries) {
      const filePath = path.join(process.cwd(), "drizzle", `${entry.tag}.sql`);
      const migration = await readFile(filePath, "utf8");
      const hash = createHash("sha256").update(migration).digest("hex");
      if (applied.has(hash)) continue;

      const statements = migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      await client.begin(async (transaction) => {
        for (const statement of statements) {
          await transaction.unsafe(statement);
        }
        await transaction`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${hash}, ${entry.when})
        `;
      });

      console.log(`Applied ${entry.tag}.sql`);
    }

    console.log("Database migrations are up to date.");
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
