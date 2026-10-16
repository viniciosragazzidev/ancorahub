import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { likePattern, SQL_ACCENT_FROM, SQL_ACCENT_TO } from "./search-terms";

/**
 * SQL that finds the rows whose text contains any of the terms and counts how
 * many of them each row has, ignoring case and accents. Null without terms.
 *
 * `translate` does the accent folding, so it works without the `unaccent`
 * extension. Terms are bound as parameters, never concatenated.
 */
export function buildTermSearch(column: SQLWrapper, terms: string[]): { anyMatch: SQL; hits: SQL<number> } | null {
  if (terms.length === 0) return null;
  const normalized = sql`lower(translate(${column}, ${SQL_ACCENT_FROM}, ${SQL_ACCENT_TO}))`;
  const matches = terms.map((term) => sql`(${normalized} like ${likePattern(term)})`);
  return {
    anyMatch: sql`(${sql.join(matches, sql` or `)})`,
    hits: sql<number>`(${sql.join(
      matches.map((match) => sql`(case when ${match} then 1 else 0 end)`),
      sql` + `,
    )})`,
  };
}
