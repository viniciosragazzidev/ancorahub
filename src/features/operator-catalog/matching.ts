import { normalizeName } from "./taxonomy";

export type NamedEntity = { id: string; name: string; code?: string | null; aliases?: string[] };

function aliasesOf(metadata: unknown): string[] {
  const aliases = metadata && typeof metadata === "object" ? (metadata as { aliases?: unknown }).aliases : undefined;
  return Array.isArray(aliases) ? aliases.filter((alias): alias is string => typeof alias === "string") : [];
}

export function toNamedEntity(row: { id: string; name: string; code?: string | null; metadata?: unknown }): NamedEntity {
  return { id: row.id, name: row.name, code: row.code ?? null, aliases: aliasesOf(row.metadata) };
}

function namesOf(entity: NamedEntity) {
  return [entity.name, entity.code ?? "", ...(entity.aliases ?? [])].map(normalizeName).filter(Boolean);
}

/**
 * The operator with this name: same normalized name or alias, or one name
 * starting with the other ("Amil" and "Amil Assistência Médica").
 */
export function matchCarrier(name: string, carriers: NamedEntity[]) {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  const exact = carriers.find((carrier) => namesOf(carrier).includes(wanted));
  if (exact) return exact;
  return carriers.find((carrier) => namesOf(carrier).some((known) => {
    const [short, long] = known.length < wanted.length ? [known, wanted] : [wanted, known];
    return short.length >= 4 && long.startsWith(short);
  })) ?? null;
}

/** A plan name without the operator's name in front: "Amil S380" and "S380" are the same plan. */
export function planNameCore(name: string, carrierName: string | null) {
  const normalized = normalizeName(name);
  const carrier = carrierName ? normalizeName(carrierName) : "";
  return carrier && normalized.startsWith(carrier) && normalized.length > carrier.length ? normalized.slice(carrier.length) : normalized;
}

/** The plan with this name, code or alias inside one operator. */
export function matchPlan(name: string, plans: NamedEntity[], carrierName: string | null) {
  const wanted = planNameCore(name, carrierName);
  if (!wanted) return null;
  return plans.find((plan) => namesOf(plan).some((known) => planNameCore(known, carrierName) === wanted)) ?? null;
}
