/**
 * Adesão: o que o cliente disse ("OAB", "sou advogado", "CREA-RJ") vira a entidade exata do catálogo.
 * Puro. Reaproveita o `matchEntity` do guia do /cotacao e tenta a lista de profissões do catálogo.
 */
import type { CatalogPlan } from "@/features/global-catalog/pilot/contracts";
import { fold } from "@/features/global-catalog/pilot/engine";
import { matchEntity, type Facet } from "@/features/global-catalog/pilot/guide/guide-flow";

export type EntityResolution = { entity: string } | { options: string[] } | { unknown: true };

export function entityFacets(plans: readonly Pick<CatalogPlan, "modality" | "entity">[], modality: string): Facet[] {
  const counts = new Map<string, number>();
  for (const plan of plans) if (plan.modality === modality && plan.entity) counts.set(plan.entity, (counts.get(plan.entity) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "pt-BR"));
}

function attempt(text: string, facets: readonly Facet[]): EntityResolution | null {
  const result = matchEntity(text, facets);
  if ("entity" in result) return { entity: result.entity };
  if ("options" in result) return { options: result.options.slice(0, 3).map((option) => option.value) };
  return null;
}

export function resolveEntity(text: string, facets: readonly Facet[], professions: readonly { label: string; value: string }[] = []): EntityResolution {
  const typed = text.replace(/^(sou|eu sou|trabalho como|minha profiss[aã]o [eé])\s+/i, "").trim();
  if (!typed) return { unknown: true };
  const direct = attempt(typed, facets);
  if (direct) return direct;
  // Profissão ("advogado") para a entidade que a lista de profissões do catálogo aponta.
  const wanted = fold(typed);
  const profession = professions.find((item) => fold(item.label).includes(wanted) || wanted.includes(fold(item.label)));
  if (profession) return attempt(profession.value, facets) ?? attempt(profession.label, facets) ?? { unknown: true };
  return { unknown: true };
}
