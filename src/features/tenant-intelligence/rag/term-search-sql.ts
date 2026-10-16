import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { likePattern, SQL_ACCENT_FROM, SQL_ACCENT_TO } from "./search-terms";

/**
 * SQL that finds the rows whose text contains any of the terms and counts how
 * many of them each row has, ignoring case and accents. Null without terms.
 *
 * `ancora_fold` (migration 0205) lowercases and removes accents, and a trigram
 * index on it keeps the substring search from scanning every chunk. Terms are
 * bound as parameters, never concatenated.
 *
 * Migrations are applied by hand, so the function may not exist yet: the
 * "inline" mode does the same folding with `translate` and works on any
 * database, only without the index.
 */
export function buildTermSearch(
  column: SQLWrapper,
  terms: string[],
  mode: "function" | "inline" = "function",
): { anyMatch: SQL; hits: SQL<number> } | null {
  if (terms.length === 0) return null;
  const normalized =
    mode === "function"
      ? sql`ancora_fold(${column})`
      : sql`lower(translate(${column}, ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}))`;
  const matches = terms.map((term) => sql`(${normalized} like ${likePattern(term)})`);
  return {
    anyMatch: sql`(${sql.join(matches, sql` or `)})`,
    hits: sql<number>`(${sql.join(
      matches.map((match) => sql`(case when ${match} then 1 else 0 end)`),
      sql` + `,
    )})`,
  };
}
