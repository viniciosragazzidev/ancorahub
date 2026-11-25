import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ wheres: [] as unknown[], joins: [] as unknown[], results: [] as unknown[][], limit: 0, offset: 0 }));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  function chain() {
    const result = state.results.shift() ?? [];
    const builder: Record<string, unknown> = {};
    for (const name of ["from", "orderBy"]) builder[name] = () => builder;
    builder.leftJoin = (_table: unknown, on: unknown) => { state.joins.push(on); return builder; };
    builder.where = (where: unknown) => { state.wheres.push(where); return builder; };
    builder.limit = (value: number) => { state.limit = value; return builder; };
    builder.offset = (value: number) => { state.offset = value; return builder; };
    builder.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return builder;
  }
  return { schema, getDatabase: () => ({ select: () => chain() }) };
});

import { aiRunsWhere, countActiveQualifications, getAiRunsSummary, listAiRuns } from "./ai-runs-service";

const dialect = new PgDialect();
const compile = (where: unknown) => dialect.sqlToQuery(where as SQL);

beforeEach(() => {
  state.wheres = [];
  state.joins = [];
  state.results = [];
  state.limit = 0;
  state.offset = 0;
});

describe("execuções da IA: consulta sempre presa à empresa", () => {
  it("filtra pela empresa e, com Só falhas, pelas situações de falha", () => {
    const base = compile(aiRunsWhere("tenant-a"));
    expect(base.sql).toContain('"ai_attendance_logs"."tenant_id" = $1');
    expect(base.params).toEqual(["tenant-a"]);
    const failures = compile(aiRunsWhere("tenant-a", { onlyFailures: true }));
    expect(failures.sql).toContain('"ai_attendance_logs"."status" in ($2, $3)');
    expect(failures.params).toEqual(["tenant-a", "failed", "delivery_failed"]);
  });

  it("lista com a junção do lead presa à mesma empresa e pagina", async () => {
    state.results = [[{ value: 60 }], [{ id: "log-1", createdAt: new Date("2026-11-25T12:00:00Z"), leadId: "lead-1", leadName: "Ana", purpose: "openrouter", model: "gpt", status: "failed", latencyMs: 900, totalTokens: 10, estimatedCost: "0", errorMessage: "429" }]];
    const result = await listAiRuns("tenant-a", { onlyFailures: true, page: 2 });
    expect(state.wheres.map((where) => compile(where).params[0])).toEqual(["tenant-a", "tenant-a"]);
    const join = compile(state.joins[0]);
    expect(join.sql).toContain('"leads"."tenant_id" = $1');
    expect(join.params).toEqual(["tenant-a"]);
    expect(state.limit).toBe(25);
    expect(state.offset).toBe(25);
    expect(result).toMatchObject({ page: 2, totalPages: 3, totalItems: 60 });
    expect(result.rows[0]).toMatchObject({ id: "log-1", leadName: "Ana", createdAt: "2026-11-25T12:00:00.000Z" });
  });

  it("página pedida além do fim volta para a última", async () => {
    state.results = [[{ value: 3 }], []];
    const result = await listAiRuns("tenant-a", { page: 9 });
    expect(result.page).toBe(1);
    expect(state.offset).toBe(0);
  });

  it("resumo de 24 h e leads em qualificação também ficam na empresa", async () => {
    state.results = [[{ value: 40 }], [{ value: 2 }]];
    const now = new Date("2026-11-25T12:00:00Z");
    await expect(getAiRunsSummary("tenant-b", now)).resolves.toEqual({ total: 40, failed: 2 });
    for (const where of state.wheres) {
      const query = compile(where);
      expect(query.params[0]).toBe("tenant-b");
      expect(query.sql).toContain('"ai_attendance_logs"."created_at" >=');
    }
    state.wheres = [];
    state.results = [[{ value: 5 }]];
    await expect(countActiveQualifications("tenant-b")).resolves.toBe(5);
    expect(compile(state.wheres[0]).params).toEqual(["tenant-b", "NEW", "IN_PROGRESS"]);
  });
});
