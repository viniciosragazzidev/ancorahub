import { afterEach, describe, expect, it, vi } from "vitest";
import { connectionLimit, usesPostgresJsDriver } from "./client";

describe("usesPostgresJsDriver", () => {
  it("selects postgres-js for Supabase direct and pooler URLs regardless of env variable name", () => {
    expect(usesPostgresJsDriver("postgresql://user:password@db.project.supabase.com:5432/postgres")).toBe(true);
    expect(usesPostgresJsDriver("postgresql://user:password@aws-1-us-east-2.pooler.supabase.com:6543/postgres")).toBe(true);
  });

  it("keeps the Neon adapter for non-Supabase database URLs", () => {
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
    expect(connectionLimit()).toBe(4);
  });

  it("allows an explicit bounded production override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DB_POOL_MAX", "2");

    expect(connectionLimit()).toBe(2);
  });
});
