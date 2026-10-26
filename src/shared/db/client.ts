import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { callDbQueryHook } from "@/shared/observability/db-hook";
import { isInBackgroundPool } from "./background-pool";

type Database = ReturnType<typeof drizzlePostgres<typeof schema>>;

/**
 * Os pools moram no processo, não no módulo (26/10). O build de produção inclui este módulo em
 * mais de um bundle (páginas, rotas de API, jobs); com `let` no módulo cada cópia abria o próprio
 * pool de 4 + 3, e um só container chegou a 18 conexões no pooler de sessão (limite de 30 para o
 * projeto). Com o deploy subindo um segundo container, o pooler estourava (EMAXCONNSESSION) e
 * todas as rotas caíam. A chave global garante no máximo um pool de páginas e um de jobs por processo.
 */
type DatabasePools = { database?: Database; backgroundDatabase?: Database };
const POOLS_KEY = Symbol.for("ancorahub.db.pools");
const processPools = globalThis as typeof globalThis & { [POOLS_KEY]?: DatabasePools };
const pools: DatabasePools = (processPools[POOLS_KEY] ??= {});

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
  // heavy page. The transaction pooler (6543) takes 10 safely. The session
  // pooler (5432) allows `pool size` clients for the whole project (every app, job
  // and script): with the default 15, more than 2 here ran it out (EMAXCONNSESSION)
  // and broke /leads. Pool size is 30 since 2026-10-06, and a probe inside the app
  // container measured 4-5 session sockets as safe (30 parallel logins, p95 < 100 ms),
  // so production uses 4. The transaction pooler hung under load on this project
  // (scripts/db-pool-probe.cjs), so keep the CRM on 5432 until that is solved.
  if (process.env.NODE_ENV !== "production") return isTransactionPooler() ? 3 : 2;
  return isTransactionPooler() ? 10 : 4;
}

/**
 * On the transaction pooler sockets stay open (reconnecting — TLS + auth +
 * type lookup — on every idle gap cost ~350k reconnects). On the session
 * pooler each socket holds one of the project's 15 slots, so it is released
 * quickly, as before.
 */
// 24/10: 5 s on the session pooler reconnected (TLS + auth) after every short pause, adding
// 50-150 ms to the next click. 30 s keeps the few sockets warm and still frees them quickly.
const IDLE_TIMEOUT_SECONDS = isTransactionPooler() ? 120 : 30;
const MAX_LIFETIME_SECONDS = isTransactionPooler() ? 30 * 60 : 60;

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

/**
 * Sockets for background work (jobs, webhooks, their after() work): its own small pool, so
 * a job or a burst of WhatsApp messages never takes the sockets that serve the pages.
 */
export function backgroundConnectionLimit() {
  const configured = Number.parseInt(process.env.DB_BACKGROUND_POOL_MAX ?? "", 10);
  if (Number.isFinite(configured) && configured >= 1 && configured <= 10) return configured;
  // 26/10: with one pool per process (EMAXCONNSESSION fix), 3 sockets served every job and
  // webhook at once and the distribution job hit Coolify's 300 s timeout. 8 + 4 for pages = 12
  // per container, still under the 18 a single container held before that fix.
  return process.env.NODE_ENV === "production" ? 8 : 1;
}

function createPostgresDatabase(databaseUrl: string, max = connectionLimit()): Database {
  logDbConfig(databaseUrl);

  return drizzlePostgres(
    postgres(databaseUrl, {
      prepare: false,
      max,
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
  // Jobs and webhooks (backgroundRoute) get their own pool; pages keep theirs.
  if (isInBackgroundPool() && usesPostgresJsDriver(databaseUrl)) {
    pools.backgroundDatabase ??= createPostgresDatabase(databaseUrl, backgroundConnectionLimit());
    return pools.backgroundDatabase;
  }
  if (usesPostgresJsDriver(databaseUrl)) {
    pools.database ??= createPostgresDatabase(databaseUrl);
  } else {
    pools.database ??= drizzle(
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
  return pools.database;
}

export { schema };
