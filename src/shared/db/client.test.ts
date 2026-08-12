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

  it("uses one database socket by default in serverless production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("DB_POOL_MAX", "");

    expect(connectionLimit()).toBe(1);
  });

  it("allows an explicit bounded production override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DB_POOL_MAX", "2");

    expect(connectionLimit()).toBe(2);
  });
});
