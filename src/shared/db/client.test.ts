import { describe, expect, it } from "vitest";
import { usesPostgresJsDriver } from "./client";

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
