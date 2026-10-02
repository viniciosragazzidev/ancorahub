import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { callDbQueryHook } from "@/shared/observability/db-hook";

type Database = ReturnType<typeof drizzlePostgres<typeof schema>>;

let database: Database | undefined;

/** Supavisor transaction mode (port 6543): many client sockets share few server connections. */
export function isTransactionPooler(databaseUrl = process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim() || "") {
  try {
    const url = new URL(databaseUrl);
    return url.hostname.includes("pooler.supabase.com") && url.port === "6543";
  } catch {
    return false;
  }
}

export function connectionLimit() {
  // Static generation uses several workers and must not serialize all page-data
  // queries through a single socket.
  if (process.env.NEXT_PHASE === "phase-production-build") return 3;
  const configured = Number.parseInt(process.env.DB_POOL_MAX ?? "", 10);
  if (Number.isFinite(configured) && configured >= 1 && configured <= 20) return configured;
  // The CRM is one long-lived Node process on the VPS (Coolify): every user's
  // queries share this pool, so 1–2 sockets queued the whole team behind any
  // heavy page. The transaction pooler (6543) takes 10 safely; the session
  // pooler (5432) caps clients per project, so it gets fewer.
  if (process.env.NODE_ENV !== "production") return 3;
  return isTransactionPooler() ? 10 : 4;
}

/** Long-lived sockets: reconnecting (TLS + auth + type lookup) on every idle gap cost ~350k reconnects. */
const IDLE_TIMEOUT_SECONDS = 120;
const MAX_LIFETIME_SECONDS = 30 * 60;

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

/**
 * Log database configuration for observability (no credentials).
 */
function logDbConfig(databaseUrl: string): void {
  try {
    const url = new URL(databaseUrl);
    const isPooled = url.hostname.includes("pooler") || url.hostname.includes("ep-");
    const poolMax = connectionLimit();
    console.log(
      JSON.stringify({
        type: "db_config",
        hostname: url.hostname,
        isPooled,
        poolMax,
        driver: usesPostgresJsDriver(databaseUrl) ? "postgres.js" : "neon-serverless",
        prepare: false,
        connectTimeoutSeconds: 10,
        idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
        maxLifetimeSeconds: MAX_LIFETIME_SECONDS,
        transactionPooler: isTransactionPooler(databaseUrl),
        statementTimeoutMs: statementTimeoutMs(),
        env: process.env.NODE_ENV,
      }),
    );
  } catch {
    // URL parsing failed — non-critical
  }
}

/**
 * Server-wide guard: no single statement may monopolize a pooled connection.
 * Supabase pooler connections are shared by every route; a slow statement
 * (full scans, unbounded deletes) blocks all requests behind it. Bounded
 * here so runaway queries fail fast instead of hanging the whole app.
 * Operators can tune or disable via DB_STATEMENT_TIMEOUT_MS.
 */
function statementTimeoutMs(): number {
  const configured = Number.parseInt(process.env.DB_STATEMENT_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(configured) && configured >= 1_000) return configured;
  return 30_000;
}

function createPostgresDatabase(databaseUrl: string): Database {
  logDbConfig(databaseUrl);

  return drizzlePostgres(
    postgres(databaseUrl, {
      prepare: false,
      max: connectionLimit(),
      connect_timeout: 10,
      idle_timeout: IDLE_TIMEOUT_SECONDS,
      max_lifetime: MAX_LIFETIME_SECONDS,
      // postgres.js offers an issue-time debug hook, not a completion hook.
      // It is used only to count/hash query shapes inside an opt-in request
      // trace; raw SQL and parameters are discarded before logging.
      debug: (_connection, query) => callDbQueryHook(query),
      connection: {
        statement_timeout: statementTimeoutMs(),
        idle_in_transaction_session_timeout: 60_000,
      },
      onnotice: () => {}, // Suppress noisy notices
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
        idleTimeoutMillis: IDLE_TIMEOUT_SECONDS * 1000,
        connectionTimeoutMillis: 5000,
        options: `-c statement_timeout=${statementTimeoutMs()}`,
      }),
      { schema },
    ) as unknown as Database;
  }
  return database;
}

export { schema };
