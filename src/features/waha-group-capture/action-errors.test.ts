import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { describeActionError } from "./action-errors";

const FALLBACK = "Não foi possível iniciar a conexão.";

describe("describeActionError", () => {
  it("never shows the query or its values for a database error", () => {
    const driver = Object.assign(new Error('new row violates check constraint "waha_numbers_scope_check"'), { code: "23514" });
    const wrapped = new Error('Failed query: insert into "waha_numbers" ("id") values ($1) params: 7leb325a-secret', { cause: driver });

    const message = describeActionError(wrapped, FALLBACK);

    expect(message).not.toContain("insert into");
    expect(message).not.toContain("7leb325a");
    expect(message).toContain("migração 0206");
  });

  it("says a migration is missing for an absent table or function", () => {
    expect(describeActionError({ code: "42P01" }, FALLBACK)).toContain("42P01");
    expect(describeActionError({ cause: { code: "42883" } }, FALLBACK)).toContain("migrações");
  });

  it("shows only the code for any other database error", () => {
    expect(describeActionError({ code: "23505" }, FALLBACK)).toBe(`${FALLBACK} Erro de banco (23505).`);
  });

  it("hides a failed query even when its cause has no code", () => {
    expect(describeActionError(new Error('Failed query: select * from "user" where password = $1'), FALLBACK)).toBe(
      `${FALLBACK} Erro de banco.`,
    );
  });

  it("lets the errors the code raised itself through", () => {
    expect(describeActionError(new Error("Apenas o Diretor pode gerenciar os materiais de operadoras."), FALLBACK)).toBe(
      "Apenas o Diretor pode gerenciar os materiais de operadoras.",
    );
    expect(describeActionError("texto", FALLBACK)).toBe(FALLBACK);
  });
});

// The scope the code writes must be one the database constraint accepts: this is what failed in production.
describe("materials channel scope and migration 0206", () => {
  const migration = readFileSync(join(process.cwd(), "drizzle", "0206_waha_numbers_materials_scope.sql"), "utf8");
  const channelSource = readFileSync(join(process.cwd(), "src", "features", "waha-cadence", "tenant-channel.ts"), "utf8");

  it("allows the scope the materials channel inserts", () => {
    expect(channelSource).toContain('scope: "tenant_materials"');
    expect(migration).toContain(`"scope" = 'tenant_materials' AND "tenant_id" IS NOT NULL AND "branch_id" IS NULL`);
  });

  it("keeps the three scopes that existed, with the same rules", () => {
    expect(migration).toContain(`"scope" = 'platform' AND "tenant_id" IS NULL AND "branch_id" IS NULL`);
    expect(migration).toContain(`"scope" = 'tenant' AND "tenant_id" IS NOT NULL AND "branch_id" IS NULL`);
    expect(migration).toContain(`"scope" = 'branch' AND "tenant_id" IS NOT NULL AND "branch_id" IS NOT NULL`);
  });

  it("replaces the constraint in one statement, so the table is never unprotected", () => {
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "waha_numbers_scope_check"');
    expect(migration.split("statement-breakpoint")).toHaveLength(1);
  });
});
