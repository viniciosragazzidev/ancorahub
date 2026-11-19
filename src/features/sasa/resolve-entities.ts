/**
 * "o Carlos" → qual lead. Puro, sobre a lista que o servidor já carregou dentro do escopo do corretor
 * (só os leads dele, do tenant da sessão): um lead de outro corretor nem aparece aqui.
 * Nome completo vence primeiro nome; empate vira escolha por toque (plano §3.3).
 */
import { normalizePtBr } from "./parse-when";

export type SasaLead = { id: string; name: string; status: string };
export type LeadMatch<T extends SasaLead = SasaLead> = { kind: "one"; lead: T } | { kind: "many"; leads: T[] } | { kind: "none" };

const STOP = new Set(["de", "da", "do", "das", "dos", "e"]);
const MAX_CHOICES = 4;

function words(text: string) {
  return normalizePtBr(text).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 2 && !STOP.has(word));
}

function score(lead: SasaLead, spoken: Set<string>, spokenText: string) {
  const parts = words(lead.name);
  if (!parts.length) return 0;
  const full = parts.join(" ");
  if (parts.length > 1 && ` ${spokenText} `.includes(` ${full} `)) return 3;
  const hits = parts.filter((part) => spoken.has(part)).length;
  if (hits >= 2) return 2;
  return spoken.has(parts[0]!) ? 1 : 0;
}

export function resolveLead<T extends SasaLead>(text: string, leads: T[], hint?: string | null): LeadMatch<T> {
  const source = [text, hint ?? ""].join(" ");
  const spokenWords = words(source);
  const spoken = new Set(spokenWords);
  const spokenText = spokenWords.join(" ");
  let best = 0;
  let found: T[] = [];
  for (const lead of leads) {
    const value = score(lead, spoken, spokenText);
    if (value > best) { best = value; found = [lead]; }
    else if (value === best && value > 0) found.push(lead);
  }
  if (!best) return { kind: "none" };
  if (found.length === 1) return { kind: "one", lead: found[0]! };
  return { kind: "many", leads: found.slice(0, MAX_CHOICES) };
}

/** "Carlos Teixeira" → "Carlos". */
export function firstNameOf(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
