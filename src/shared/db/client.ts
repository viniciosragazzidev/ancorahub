import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = ReturnType<typeof drizzlePostgres<typeof schema>>;

let database: Database | undefined;

export function connectionLimit() {
  // Static generation uses several workers and must not serialize all page-data
  // queries through a single socket. Runtime serverless instances stay capped
  // at a low number to protect Supabase's project limit.
  if (process.env.NEXT_PHASE === "phase-production-build") return 3;
  const configured = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
  if (Number.isFinite(configured) && configured >= 1 && configured <= 10) return configured;
  // Each serverless instance can be multiplied by concurrent route renders.
  // Keep the default to one socket in production; postgres.js queues concurrent
  // queries inside the invocation instead of exhausting the project's shared
  // connection limit. Operators can raise it deliberately with DB_POOL_MAX.
  return process.env.NODE_ENV === "production" ? 1 : 3;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for database-backed operations. Add it to .env.local or the server environment.",
    );
  }
  return databaseUrl;
}

/**
 * Supabase exposes standard PostgreSQL URLs, often through a pooler hostname.
 * The provider must be inferred from the URL rather than from the environment
 * variable name: production uses DATABASE_URL while local development uses
 * SUPABASE_DB_URL.
 */
export function usesPostgresJsDriver(databaseUrl: string): boolean {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return hostname.endsWith(".supabase.com");
  } catch {
    return false;
  }
}

function createPostgresDatabase(databaseUrl: string): Database {
  return drizzlePostgres(
    postgres(databaseUrl, {
      prepare: false,
      max: connectionLimit(),
      connect_timeout: 10,
      idle_timeout: 5,
      max_lifetime: 60,
      // With the pool increased to 3 and cron routes wrapped in try/catch,
      // a single slow query no longer blocks all page requests.
      // If deeper query-level control is needed, pass ?statement_timeout=25000
      // in the connection URL or use a Drizzle query hook.
    }),
    { schema },
  );
}

/** Infrastructure-only database entry point. Domain code must use tenantDb. */
export function getDatabase(): Database {
  const databaseUrl = getDatabaseUrl();
  if (usesPostgresJsDriver(databaseUrl)) {
    database ??= createPostgresDatabase(databaseUrl);
  } else {
    database ??= drizzle(
      new Pool({
        connectionString: databaseUrl,
        max: connectionLimit(),
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 5000,
      }),
      { schema },
    ) as unknown as Database;
  }
  return database;
}

export { schema };
