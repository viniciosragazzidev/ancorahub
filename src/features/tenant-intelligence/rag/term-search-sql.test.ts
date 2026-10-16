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

  it("matches any term, accent- and case-insensitively, with the terms as bound parameters", () => {
    const search = buildTermSearch(chunks.text, ["cotacao", "amil"])!;
    const { sql: query, params } = dialect.sqlToQuery(search.anyMatch);

    expect(query).toBe(
      '((lower(translate("chunks"."text", $1, $2)) like $3) or (lower(translate("chunks"."text", $4, $5)) like $6))',
    );
    expect(params).toEqual([SQL_ACCENT_FROM, SQL_ACCENT_TO, "%cotacao%", SQL_ACCENT_FROM, SQL_ACCENT_TO, "%amil%"]);
  });

  it("counts how many terms a row has, for ranking", () => {
    const search = buildTermSearch(chunks.text, ["cotacao", "amil"])!;
    const { sql: query } = dialect.sqlToQuery(search.hits);

    expect(query).toContain("case when (lower(translate(\"chunks\".\"text\", $1, $2)) like $3) then 1 else 0 end");
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
