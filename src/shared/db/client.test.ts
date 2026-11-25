import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionLimit, databaseIdleTimeoutSeconds, POSTGRES_FETCH_TYPES_ENABLED, usesPostgresJsDriver } from "./client";

describe("usesPostgresJsDriver", () => {
  it("selects postgres-js for Supabase direct and pooler URLs regardless of env variable name", () => {
    expect(usesPostgresJsDriver("postgresql://user:password@db.project.supabase.com:5432/postgres")).toBe(true);
    expect(usesPostgresJsDriver("postgresql://user:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres")).toBe(true);
  });

  it("uses native PostgreSQL for local databases without changing hosted Neon selection", () => {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      expect(usesPostgresJsDriver(`postgres://erp_test@${host}:5442/erp_test`)).toBe(true);
    }
    expect(usesPostgresJsDriver("https://localhost:5442/erp_test")).toBe(false);
    // Banco próprio na VPS (Coolify): o host é o nome do container.
    expect(usesPostgresJsDriver("postgres://app:secret@ancorahub-db:5432/ancorahub")).toBe(true);
    expect(usesPostgresJsDriver("postgresql://user:password@ep-example.us-east-2.aws.neon.tech/neondb")).toBe(false);
    expect(usesPostgresJsDriver("not-a-database-url")).toBe(false);
  });
});

describe("connectionLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("gives the single VPS process 10 sockets on the transaction pooler and 4 on the session pooler", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("DB_POOL_MAX", "");
    vi.stubEnv("SUPABASE_DB_URL", "");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres");
    expect(connectionLimit()).toBe(10);

    vi.stubEnv("DATABASE_URL", "postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:5432/postgres");
    expect(connectionLimit()).toBe(6);
  });

  it("allows an explicit bounded production override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DB_POOL_MAX", "2");

    expect(connectionLimit()).toBe(2);
  });
});

describe("database idle timeout", () => {
  it("keeps the page pool at its current timeout and extends only background postgres pools", () => {
    const transactionPooler = "postgresql://u:p@aws-0-sa-east-1.pooler.supabase.com:6543/postgres";
    const sessionPooler = "postgresql://u:p@db.example.test:5432/postgres";

    expect(databaseIdleTimeoutSeconds(transactionPooler)).toBe(120);
    expect(databaseIdleTimeoutSeconds(sessionPooler)).toBe(30);
    expect(databaseIdleTimeoutSeconds(transactionPooler, true)).toBe(600);
    expect(databaseIdleTimeoutSeconds(sessionPooler, true)).toBe(30);
    expect(POSTGRES_FETCH_TYPES_ENABLED).toBe(true);
  });
});

describe("databaseSslOption", () => {
  it("keeps the URL's own sslmode unless DATABASE_SSL says otherwise", async () => {
    const { databaseSslOption } = await import("./client");
    expect(databaseSslOption({} as unknown as NodeJS.ProcessEnv)).toBeUndefined();
    expect(databaseSslOption({ DATABASE_SSL: "require" } as unknown as NodeJS.ProcessEnv)).toBe("require");
    expect(databaseSslOption({ DATABASE_SSL: "verify-full" } as unknown as NodeJS.ProcessEnv)).toBe("verify-full");
    expect(databaseSslOption({ DATABASE_SSL: "qualquer" } as unknown as NodeJS.ProcessEnv)).toBeUndefined();
  });
});
