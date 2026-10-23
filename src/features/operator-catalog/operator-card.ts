import { z } from "zod";

/**
 * The operator answer as a card (23/10): the model returns sections of rows (plan and
 * value, hospital and service) with the source of each row, and the chat draws it as a
 * card instead of a wall of text with "**" and "[F38]". The same content, flattened with
 * its citations, goes through the grounding guard; the broker copies a clean version.
 * Pure: tested in operator-card.test.ts.
 */

const cite = z.union([z.string(), z.array(z.string())]).optional().catch(undefined)
  .transform((value) => (Array.isArray(value) ? value.join(", ") : value ?? "").replace(/[[\]]/g, "").trim());

const rowSchema = z.object({
  label: z.string().trim().catch(""),
  value: z.string().trim().optional().catch(undefined).transform((value) => value ?? ""),
  cite,
});

export const operatorAnswerSchema = z.object({
  found: z.boolean().catch(false),
  intro: z.string().trim().optional().catch(undefined).transform((value) => value ?? ""),
  sections: z.array(z.object({
    title: z.string().trim().catch(""),
    rows: z.array(rowSchema).catch([]),
  })).catch([]),
  notes: z.array(z.string().trim()).optional().catch(undefined).transform((value) => (value ?? []).filter(Boolean)),
  missing: z.string().trim().optional().catch(undefined),
});

export type OperatorAnswerJson = z.infer<typeof operatorAnswerSchema>;

export type OperatorCardRow = { label: string; value: string; source: string | null };
export type OperatorCard = {
  intro: string;
  sections: Array<{ title: string; rows: OperatorCardRow[] }>;
  notes: string[];
  missing: string | null;
  sources: string[];
};

const MAX_SECTIONS = 12;
const MAX_ROWS = 40;

function cleanSections(json: OperatorAnswerJson) {
  return json.sections
    .map((section) => ({ title: section.title.replace(/\*+/g, "").slice(0, 120), rows: section.rows.filter((row) => row.label || row.value).slice(0, MAX_ROWS) }))
    .filter((section) => section.rows.length)
    .slice(0, MAX_SECTIONS);
}

/** The answer as text with its citations, for the grounding guard and the plain chats. */
export function flattenAnswer(json: OperatorAnswerJson) {
  const parts: string[] = [];
  if (json.intro) parts.push(json.intro);
  for (const section of cleanSections(json)) {
    const rows = section.rows.map((row) => `- ${row.label}${row.value ? `: ${row.value}` : ""}${row.cite ? ` [${row.cite.split(/\s*,\s*/).join("] [")}]` : ""}`);
    parts.push([section.title ? `${section.title}:` : null, ...rows].filter(Boolean).join("\n"));
  }
  if (json.notes.length) parts.push(json.notes.join("\n"));
  return parts.join("\n\n").trim();
}

/** The card the chat draws: each row with the name of its source, citations removed. */
export function buildOperatorCard(json: OperatorAnswerJson, sourceById: Map<string, string>, missing: string | null): OperatorCard {
  const sources = new Set<string>();
  const sections = cleanSections(json).map((section) => ({
    title: section.title,
    rows: section.rows.map((row) => {
      const firstId = row.cite.split(/\s*,\s*/).find((id) => sourceById.has(id));
      const source = firstId ? sourceById.get(firstId)! : null;
      if (source) sources.add(source);
      return { label: stripCitations(row.label), value: stripCitations(row.value), source };
    }),
  }));
  return {
    intro: stripCitations(json.intro),
    sections,
    notes: json.notes.map(stripCitations).filter(Boolean),
    missing,
    sources: [...sources].slice(0, 12),
  };
}

export function stripCitations(text: string) {
  return text.replace(/\s*\[(?:[FT]\d+(?:\s*,\s*)?)+\]/g, "").replace(/\*\*/g, "").trim();
}

/** Clean text to paste for the client: no citations, no internal notes. */
export function operatorCardText(card: OperatorCard) {
  const parts: string[] = [];
  if (card.intro) parts.push(card.intro);
  for (const section of card.sections) {
    parts.push([section.title ? `*${section.title}*` : null, ...section.rows.map((row) => `• ${row.label}${row.value ? `: ${row.value}` : ""}`)].filter(Boolean).join("\n"));
  }
  return parts.join("\n\n").trim();
}
