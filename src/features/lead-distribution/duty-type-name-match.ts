/**
 * Finds the plantão type a plantão belongs to by its name ("PME 25/09",
 * "Plantão Premium · Manhã" -> PME, Premium). Pure: used by the backfill
 * script and testable without a database.
 */

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type TypeCandidate = { id: string; name: string };

export type NameMatch =
  | { kind: "match"; type: TypeCandidate }
  | { kind: "ambiguous"; types: TypeCandidate[] }
  | { kind: "none" };

/**
 * The type whose whole name appears as whole words in the plantão name. When
 * several do, the longest name wins ("PME Premium" over "PME"); a tie of the
 * same length is ambiguous and left for a person to decide.
 */
export function matchTypeByName(scheduleName: string, types: readonly TypeCandidate[]): NameMatch {
  const haystack = ` ${normalizeName(scheduleName)} `;
  const hits = types.filter((type) => {
    const needle = normalizeName(type.name);
    return needle.length > 0 && haystack.includes(` ${needle} `);
  });
  if (!hits.length) return { kind: "none" };
  const longest = Math.max(...hits.map((type) => normalizeName(type.name).length));
  const best = hits.filter((type) => normalizeName(type.name).length === longest);
  return best.length === 1 ? { kind: "match", type: best[0] } : { kind: "ambiguous", types: best };
}
