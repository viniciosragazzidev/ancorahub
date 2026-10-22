import { slugify } from "./taxonomy";

export type IncomingFact = {
  factKey: string;
  areaSlug: string;
  valueText: string;
  valueNumber: number | null;
};

export type StoredFact = {
  id: string;
  factKey: string;
  valueText: string;
  valueNumber: number | null;
  status: "current" | "pending_review";
};

export type FactAction<T extends IncomingFact> =
  /** Same value as what is stored: only the "last seen" moves. */
  | { kind: "touch"; fact: T; storedId: string }
  /** Goes live now; replaces the current value when there is one. */
  | { kind: "insert_current"; fact: T; supersedesId: string | null; divergesFromId: string | null }
  /** Waits for the director; the current value stays live until approved. */
  | { kind: "insert_pending"; fact: T; replacesId: string | null; dropsPendingId: string | null };

/** Two values are the same when their numbers match (to the cent) or, without numbers, their text does. */
export function sameValue(a: { valueText: string; valueNumber: number | null }, b: { valueText: string; valueNumber: number | null }) {
  if (a.valueNumber !== null && b.valueNumber !== null) return Math.abs(a.valueNumber - b.valueNumber) < 0.005;
  return slugify(a.valueText) === slugify(b.valueText);
}

/** Observed prices from quotes live beside the official table, under their own identity. */
export function quoteFactKey(factKey: string) {
  return `quote|${factKey}`;
}

/**
 * What to do with each fact read from a new material, against what the catalog
 * already holds for the same identities. Only differences produce writes:
 * unchanged values are touched, changed ones replace the old value (or wait
 * for review in areas that require it), and the old value is never deleted.
 *
 * Quotes never replace the table: their values are kept as observations under
 * a "quote|" key, and point at the table value when they disagree with it.
 */
export function planFactChanges<T extends IncomingFact>(input: {
  incoming: T[];
  stored: StoredFact[];
  origin: "material" | "quote";
  reviewRequired: (areaSlug: string) => boolean;
}): FactAction<T>[] {
  const currentByKey = new Map<string, StoredFact>();
  const pendingByKey = new Map<string, StoredFact>();
  for (const fact of input.stored) {
    (fact.status === "current" ? currentByKey : pendingByKey).set(fact.factKey, fact);
  }

  const actions: FactAction<T>[] = [];
  const handled = new Set<string>();
  for (const fact of input.incoming) {
    if (handled.has(fact.factKey)) continue;
    handled.add(fact.factKey);

    if (input.origin === "quote") {
      const ownKey = quoteFactKey(fact.factKey);
      const observation = { ...fact, factKey: ownKey };
      const previous = currentByKey.get(ownKey);
      if (previous && sameValue(previous, fact)) {
        actions.push({ kind: "touch", fact: observation, storedId: previous.id });
        continue;
      }
      const table = currentByKey.get(fact.factKey);
      actions.push({
        kind: "insert_current",
        fact: observation,
        supersedesId: previous?.id ?? null,
        divergesFromId: table && !sameValue(table, fact) ? table.id : null,
      });
      continue;
    }

    const current = currentByKey.get(fact.factKey);
    const pending = pendingByKey.get(fact.factKey);
    if (current && sameValue(current, fact)) {
      actions.push({ kind: "touch", fact, storedId: current.id });
      continue;
    }
    if (pending && sameValue(pending, fact)) {
      actions.push({ kind: "touch", fact, storedId: pending.id });
      continue;
    }
    if (input.reviewRequired(fact.areaSlug)) {
      actions.push({ kind: "insert_pending", fact, replacesId: current?.id ?? null, dropsPendingId: pending?.id ?? null });
      continue;
    }
    actions.push({ kind: "insert_current", fact, supersedesId: current?.id ?? null, divergesFromId: null });
  }
  return actions;
}

export function summarizeActions(actions: Array<{ kind: FactAction<IncomingFact>["kind"] } & Partial<{ supersedesId: string | null; divergesFromId: string | null; replacesId: string | null }>>) {
  return {
    unchanged: actions.filter((action) => action.kind === "touch").length,
    added: actions.filter((action) => action.kind === "insert_current" && !action.supersedesId).length,
    updated: actions.filter((action) => action.kind === "insert_current" && Boolean(action.supersedesId)).length,
    pendingReview: actions.filter((action) => action.kind === "insert_pending").length,
    divergent: actions.filter((action) => action.kind === "insert_current" && Boolean(action.divergesFromId)).length,
  };
}
