import postgres from "postgres";

type TableReference = {
  schema: string;
  name: string;
};

const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "";
const databaseRef = process.env.STAGING_DATABASE_REF?.trim().toLowerCase() || "";

function fail(message: string): never {
  throw new Error(`[sanitize:staging] ${message}`);
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function targetsExpectedBranch(connectionString: string, ref: string) {
  const parsed = new URL(connectionString);
  const searchable = `${parsed.hostname} ${decodeURIComponent(parsed.username)}`.toLowerCase();
  return searchable.includes(ref);
}

async function main() {
  if (!databaseUrl) fail("SUPABASE_DB_URL or DATABASE_URL must be provided explicitly.");
  if (!/^[a-z0-9]{20}$/.test(databaseRef)) fail("STAGING_DATABASE_REF must be a Supabase project reference.");
  if (process.env.STAGING_SANITIZATION_CONFIRMATION !== `SANITIZE_${databaseRef}`) {
    fail("Set STAGING_SANITIZATION_CONFIRMATION to the required branch-specific confirmation.");
  }
  if (!targetsExpectedBranch(databaseUrl, databaseRef)) {
    fail("The database connection does not match STAGING_DATABASE_REF. Refusing to continue.");
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
    connect_timeout: 15,
  });

  try {
    const tables = await client<TableReference[]>`
      SELECT table_schema AS schema, table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('__drizzle_migrations', 'spatial_ref_sys')
      ORDER BY table_name
    `;

    if (tables.length === 0) fail("No application tables were found in the public schema.");

    const storageExists = await client<{ exists: boolean }[]>`
      SELECT to_regclass('storage.objects') IS NOT NULL AS exists
    `;
    const qualifiedTables = tables
      .map((table) => `${quoteIdentifier(table.schema)}.${quoteIdentifier(table.name)}`)
      .join(", ");

    await client.begin(async (transaction) => {
      await transaction.unsafe(`TRUNCATE TABLE ${qualifiedTables} RESTART IDENTITY CASCADE`);
      if (storageExists[0]?.exists) {
        await transaction.unsafe("DELETE FROM storage.objects");
      }
    });

    console.log(JSON.stringify({
      operation: "staging_sanitization_completed",
      databaseRef,
      applicationTableCount: tables.length,
      storageRecordsRemoved: Boolean(storageExists[0]?.exists),
    }));
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "[sanitize:staging] unknown failure");
  process.exitCode = 1;
});
