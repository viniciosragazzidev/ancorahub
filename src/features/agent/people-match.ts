import { normalizePtBr } from "@/features/sasa/parse-when";

import type { Person } from "./types";

/**
 * Nome falado → pessoa da equipe. Puro. Um candidato forte segue; empate vira escolha na gaveta;
 * nenhum devolve erro útil (plano §4.2). Inativos só aparecem quando pedidos.
 */
export type PeopleMatch = { kind: "one"; person: Person } | { kind: "many"; people: Person[] } | { kind: "none"; inactive: Person[] };

const STOP = new Set(["de", "da", "do", "das", "dos", "e"]);
const MAX_CHOICES = 6;

function words(text: string) {
  return normalizePtBr(text).replace(/[^a-z0-9\s@.]/g, " ").split(/\s+/).filter((word) => word.length >= 2 && !STOP.has(word));
}

/** 5: e-mail ou nome completo exato; 4: nome completo contido; 3: duas partes; 2: primeiro nome; 1: só outra parte. */
export function personScore(person: Pick<Person, "name">, query: string) {
  const spoken = words(query);
  if (!spoken.length) return 0;
  const parts = words(person.name);
  if (!parts.length) return 0;
  const full = parts.join(" ");
  const spokenText = spoken.join(" ");
  if (full === spokenText) return 5;
  if (parts.length > 1 && ` ${spokenText} `.includes(` ${full} `)) return 4;
  const hits = spoken.filter((word) => parts.some((part) => part === word || (word.length >= 4 && part.startsWith(word)))).length;
  if (hits >= 2) return 3;
  if (parts[0] === spoken[0] || (spoken[0]!.length >= 4 && parts[0]!.startsWith(spoken[0]!))) return 2;
  return hits ? 1 : 0;
}

export function matchPeople(query: string, people: readonly Person[], options: { includeInactive?: boolean; role?: Person["role"] } = {}): PeopleMatch {
  const pool = options.role ? people.filter((person) => person.role === options.role) : people;
  const active = pool.filter((person) => person.status === "active");
  const scored = (options.includeInactive ? pool : active)
    .map((person) => ({ person, score: personScore(person, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, "pt-BR"));
  if (!scored.length) {
    const inactive = pool.filter((person) => person.status !== "active" && personScore(person, query) > 0).slice(0, MAX_CHOICES);
    return { kind: "none", inactive };
  }
  const best = scored[0]!.score;
  const top = scored.filter((item) => item.score === best).map((item) => item.person);
  if (top.length === 1) return { kind: "one", person: top[0]! };
  return { kind: "many", people: top.slice(0, MAX_CHOICES) };
}
