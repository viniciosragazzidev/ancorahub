import { readFileSync } from "node:fs";
import { join } from "node:path";

import { pgTable, text } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { SQL_ACCENT_FROM, SQL_ACCENT_TO } from "./search-terms";
import { buildTermSearch } from "./term-search-sql";

const chunks = pgTable("chunks", { text: text("text") });
const dialect = new PgDialect();

describe("buildTermSearch", () => {
  it("returns null when there is nothing to search for", () => {
    expect(buildTermSearch(chunks.text, [])).toBeNull();
  });

  it("matches any term through ancora_fold, with the terms as bound parameters", () => {
    const search = buildTermSearch(chunks.text, ["cotacao", "amil"])!;
    const { sql: query, params } = dialect.sqlToQuery(search.anyMatch);

    expect(query).toBe('((ancora_fold("chunks"."text") like $1) or (ancora_fold("chunks"."text") like $2))');
    expect(params).toEqual(["%cotacao%", "%amil%"]);
  });

  it("can fold with translate when the migration function is not there", () => {
    const search = buildTermSearch(chunks.text, ["cotacao", "amil"], "inline")!;
    const { sql: query, params } = dialect.sqlToQuery(search.anyMatch);

    expect(query).toBe(
      '((lower(translate("chunks"."text", $1, $2)) like $3) or (lower(translate("chunks"."text", $4, $5)) like $6))',
    );
    expect(params).toEqual([SQL_ACCENT_FROM, SQL_ACCENT_TO, "%cotacao%", SQL_ACCENT_FROM, SQL_ACCENT_TO, "%amil%"]);
    expect(query).not.toContain("ancora_fold");
  });

  it("counts how many terms a row has, for ranking", () => {
    const search = buildTermSearch(chunks.text, ["cotacao", "amil"])!;
    const { sql: query } = dialect.sqlToQuery(search.hits);

    expect(query).toContain('case when (ancora_fold("chunks"."text") like $1) then 1 else 0 end');
    expect(query).toContain(" + ");
    expect(query.match(/case when/g)).toHaveLength(2);
  });

  it("never puts a term in the SQL text, so it cannot inject", () => {
    const search = buildTermSearch(chunks.text, ["x') or 1=1 --"])!;
    const { sql: query, params } = dialect.sqlToQuery(search.anyMatch);
    expect(query).not.toContain("1=1");
    expect(params).toContain("%x') or 1=1 --%");
  });
});

describe("migration 0205", () => {
  const migration = readFileSync(join(process.cwd(), "drizzle", "0205_knowledge_search_indexes.sql"), "utf8");

  it("folds with the same accent tables the search code defines", () => {
    expect(migration).toContain(`'${SQL_ACCENT_FROM}'`);
    expect(migration).toContain(`'${SQL_ACCENT_TO}'`);
  });

  it("defines the function the query calls, as immutable so it can be indexed", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION ancora_fold(value text)");
    expect(migration).toContain("IMMUTABLE");
  });

  it("indexes the folded text with trigrams and keeps one operator file per tenant", () => {
    expect(migration).toContain('USING gin (ancora_fold("text") gin_trgm_ops)');
    expect(migration).toContain('"knowledge_sources_operator_hash_unique"');
    expect(migration).toContain("\"category\" = 'operator_material'");
  });
});
