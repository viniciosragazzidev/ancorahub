import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

import { runGateway } from "@/features/ai-gateway/gateway";
import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { getDatabase, schema } from "@/shared/db";

import { planFactChanges, quoteFactKey, summarizeActions, type IncomingFact } from "./diff";
import { embedTexts } from "./embeddings";
import {
  buildExtractionSystemPrompt,
  extractionSchema,
  MAX_EXTRACTION_WINDOWS,
  mergeExtractions,
  plausibleValidUntil,
  splitIntoWindows,
  type DocumentExtraction,
  type WindowExtraction,
} from "./extraction";
import { matchCarrier, matchPlan, toNamedEntity, type NamedEntity } from "./matching";
import {
  buildFactKey,
  canonicalQualifiers,
  mergeAreas,
  normalizeName,
  parseNumericValue,
  slugify,
  type ResolvedArea,
} from "./taxonomy";

/** A file is retried this many times before it stays "failed" for the director to see. */
const MAX_ATTEMPTS = 3;
const NUMERIC_TYPES = new Set(["number", "money", "percent", "days"]);
/** Stays in the "per minute" budget of the AI gateway, which is per user. */
const GATEWAY_USER = "system:operator-catalog";

export type CatalogSummary = {
  title?: string;
  subject?: string;
  carrierName?: string | null;
  plans?: string[];
  windows?: number;
  truncated?: boolean;
  facts?: number;
  unchanged?: number;
  added?: number;
  updated?: number;
  pendingReview?: number;
  divergent?: number;
  suggestions?: number;
  newPlans?: number;
  /** Said by the previous version and no longer by this one. */
  retired?: number;
  missingForReview?: number;
  replacedVersions?: number;
  reason?: string;
};

class CatalogRetryLater extends Error {}

export async function loadCatalogAreas(tenantId: string): Promise<ResolvedArea[]> {
  const rows = await getDatabase()
    .select({ slug: schema.operatorCatalogAreas.slug, label: schema.operatorCatalogAreas.label, description: schema.operatorCatalogAreas.description, fields: schema.operatorCatalogAreas.fields })
    .from(schema.operatorCatalogAreas)
    .where(eq(schema.operatorCatalogAreas.tenantId, tenantId));
  return mergeAreas(rows);
}

async function loadCarriers(tenantId: string) {
  const rows = await getDatabase()
    .select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name, metadata: schema.tenantPrivateCarriers.metadata })
    .from(schema.tenantPrivateCarriers)
    .where(and(eq(schema.tenantPrivateCarriers.tenantId, tenantId), isNull(schema.tenantPrivateCarriers.archivedAt)));
  return rows.map(toNamedEntity);
}

async function loadPlans(tenantId: string, carrierId: string) {
  const rows = await getDatabase()
    .select({ id: schema.tenantPrivatePlans.id, name: schema.tenantPrivatePlans.name, code: schema.tenantPrivatePlans.code, metadata: schema.tenantPrivatePlans.metadata, active: schema.tenantPrivatePlans.active })
    .from(schema.tenantPrivatePlans)
    .where(and(eq(schema.tenantPrivatePlans.tenantId, tenantId), eq(schema.tenantPrivatePlans.carrierId, carrierId), isNull(schema.tenantPrivatePlans.archivedAt)));
  return rows.map((row) => ({ ...toNamedEntity(row), active: row.active }));
}

async function extractWindow(input: { tenantId: string; system: string; window: string; index: number; total: number }) {
  const result = await runGateway({
    profile: "json-structured",
    purpose: "operator_catalog_extract",
    tenantId: input.tenantId,
    userId: GATEWAY_USER,
    sensitive: true,
    temperature: 0,
    maxTokens: 8_000,
    timeoutMs: 120_000,
    schema: extractionSchema,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: `Trecho ${input.index + 1} de ${input.total} do material:\n\n${input.window}` },
    ],
  });
  if (result.ok) return result.value;
  if (result.reason === "rate_limited") throw new CatalogRetryLater("rate_limited");
  throw new Error(`extraction_failed:${result.reason}${result.lastError ? `:${result.lastError.slice(0, 80)}` : ""}`);
}

/** Reads every window of the text, giving the AI the operator's known plan names once it knows the operator. */
async function extractDocument(tenantId: string, text: string, areas: ResolvedArea[], carriers: NamedEntity[], forcedCarrier: NamedEntity | null) {
  const allWindows = splitIntoWindows(text);
  const windows = allWindows.slice(0, MAX_EXTRACTION_WINDOWS);
  const results: WindowExtraction[] = [];
  let knownPlans: string[] = forcedCarrier ? (await loadPlans(tenantId, forcedCarrier.id)).map((plan) => plan.name) : [];
  for (const [index, window] of windows.entries()) {
    const system = buildExtractionSystemPrompt({ areas, knownCarriers: carriers.map((carrier) => carrier.name), knownPlans });
    const result = await extractWindow({ tenantId, system, window, index, total: windows.length });
    results.push(result);
    if (!knownPlans.length && result.carrier?.name) {
      const carrier = matchCarrier(result.carrier.name, carriers);
      if (carrier) knownPlans = (await loadPlans(tenantId, carrier.id)).map((plan) => plan.name);
    }
  }
  return { extraction: mergeExtractions(results), windows: windows.length, truncated: allWindows.length > windows.length };
}

async function ensureCarrier(tenantId: string, name: string, ansCode: string | null | undefined, carriers: NamedEntity[]) {
  const found = matchCarrier(name, carriers);
  if (found) return found;
  const db = getDatabase();
  const id = randomUUID();
  const [created] = await db.insert(schema.tenantPrivateCarriers).values({
    id, tenantId, name: name.trim().slice(0, 120), ansCode: ansCode?.trim() || null, metadata: { aliases: [name.trim()], createdByCatalog: true },
  }).onConflictDoNothing().returning({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name });
  if (created) return { id: created.id, name: created.name, aliases: [name.trim()] };
  // Same name created at the same time by another run.
  const [existing] = await db.select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name, metadata: schema.tenantPrivateCarriers.metadata })
    .from(schema.tenantPrivateCarriers)
    .where(and(eq(schema.tenantPrivateCarriers.tenantId, tenantId), eq(schema.tenantPrivateCarriers.name, name.trim().slice(0, 120))))
    .limit(1);
  if (!existing) throw new Error("carrier_not_created");
  return toNamedEntity(existing);
}

function planTypeFor(extraction: DocumentExtraction, planName: string): "individual" | "familiar" | "pme" | "empresarial" {
  const declared = extraction.facts.find((fact) => fact.area === "planos" && fact.field === "tipo_contratacao" && fact.plan && normalizeName(fact.plan) === normalizeName(planName))?.value ?? "";
  const hint = slugify(`${declared} ${extraction.subject} ${extraction.title}`);
  if (/pme|cnpj|mei/.test(hint)) return "pme";
  if (/empresarial|empresa|adesao/.test(hint)) return "empresarial";
  if (/familiar/.test(hint)) return "familiar";
  return "individual";
}

/**
 * Every plan the material names, matched against the operator's plans. A plan
 * never seen before is created inactive: it joins the catalog once the director
 * approves it (with its facts), so a misread name never reaches the brokers.
 */
async function resolvePlans(tenantId: string, carrier: NamedEntity, extraction: DocumentExtraction, sourceId: string) {
  const db = getDatabase();
  const plans: Array<NamedEntity & { active: boolean }> = await loadPlans(tenantId, carrier.id);
  const byName = new Map<string, { id: string; draft: boolean }>();
  const names = new Map<string, string[]>();
  for (const plan of extraction.plans) names.set(plan.name, plan.aliases);
  for (const fact of extraction.facts) if (fact.plan && !names.has(fact.plan)) names.set(fact.plan, []);
  let created = 0;
  for (const [name, aliases] of names) {
    const found = matchPlan(name, plans, carrier.name) ?? aliases.map((alias) => matchPlan(alias, plans, carrier.name)).find(Boolean) ?? null;
    if (found) {
      byName.set(normalizeName(name), { id: found.id, draft: !("active" in found) || !(found as { active: boolean }).active });
      continue;
    }
    const id = randomUUID();
    await db.insert(schema.tenantPrivatePlans).values({
      id,
      tenantId,
      carrierId: carrier.id,
      name: name.trim().slice(0, 160),
      type: planTypeFor(extraction, name),
      active: false,
      metadata: { aliases: [name.trim(), ...aliases].filter(Boolean), catalogPending: true, firstSourceId: sourceId },
    });
    const entity = { id, name: name.trim(), aliases, active: false };
    plans.push(entity);
    byName.set(normalizeName(name), { id, draft: true });
    created += 1;
  }
  return { planOf: (name: string | null | undefined) => (name ? byName.get(normalizeName(name)) ?? null : null), created };
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  // Midday in São Paulo: the date never shifts a day across the timezone.
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

type ResolvedFact = IncomingFact & {
  planId: string | null;
  fieldKey: string;
  unit: string | null;
  qualifiers: Record<string, string>;
  page: number | null;
  excerpt: string | null;
  draftPlan: boolean;
};

function resolveFacts(extraction: DocumentExtraction, carrierId: string, areas: ResolvedArea[], planOf: (name: string | null | undefined) => { id: string; draft: boolean } | null) {
  const areaBySlug = new Map(areas.map((area) => [area.slug, area]));
  return extraction.facts.map((fact): ResolvedFact => {
    const areaSlug = slugify(fact.area);
    const fieldKey = slugify(fact.field);
    const plan = planOf(fact.plan);
    const qualifiers = canonicalQualifiers(fact.qualifiers);
    const fieldType = areaBySlug.get(areaSlug)?.fields.find((field) => field.key === fieldKey)?.type;
    const valueText = fact.value.trim();
    return {
      factKey: buildFactKey({ carrierId, planId: plan?.id ?? null, areaSlug, fieldKey, qualifiers, value: valueText }),
      areaSlug,
      fieldKey,
      valueText,
      valueNumber: fieldType && NUMERIC_TYPES.has(fieldType) ? parseNumericValue(valueText) : null,
      planId: plan?.id ?? null,
      unit: fact.unit?.trim() || null,
      qualifiers,
      page: typeof fact.page === "number" ? fact.page : null,
      excerpt: fact.excerpt?.trim().slice(0, 500) || null,
      draftPlan: plan?.draft ?? false,
    };
  });
}

/** Facts the AI put in an area or field the catalog does not have yet, plus the ones it suggested itself. */
function collectSuggestions(extraction: DocumentExtraction, facts: ResolvedFact[], areas: ResolvedArea[]) {
  const areaBySlug = new Map(areas.map((area) => [area.slug, area]));
  const suggestions = new Map<string, { kind: "area" | "field"; areaSlug: string; fieldKey: string; label: string; description: string | null; example: string | null }>();
  const add = (item: { kind: "area" | "field"; areaSlug: string; fieldKey: string; label: string; description?: string | null; example?: string | null }) => {
    const key = `${item.kind}|${item.areaSlug}|${item.fieldKey}`;
    if (!suggestions.has(key)) suggestions.set(key, { ...item, description: item.description ?? null, example: item.example ?? null });
  };
  for (const suggestion of extraction.suggestions) {
    const areaSlug = slugify(suggestion.area);
    const fieldKey = suggestion.kind === "field" ? slugify(suggestion.field ?? suggestion.label) : "";
    if (suggestion.kind === "area" && areaBySlug.has(areaSlug)) continue;
    if (suggestion.kind === "field" && areaBySlug.get(areaSlug)?.fields.some((field) => field.key === fieldKey)) continue;
    add({ kind: suggestion.kind, areaSlug, fieldKey, label: suggestion.label, description: suggestion.description, example: suggestion.example });
  }
  for (const fact of facts) {
    const area = areaBySlug.get(fact.areaSlug);
    if (!area) add({ kind: "area", areaSlug: fact.areaSlug, fieldKey: "", label: fact.areaSlug.replace(/_/g, " "), example: fact.valueText.slice(0, 200) });
    else if (!area.fields.some((field) => field.key === fact.fieldKey)) add({ kind: "field", areaSlug: fact.areaSlug, fieldKey: fact.fieldKey, label: fact.fieldKey.replace(/_/g, " "), example: fact.valueText.slice(0, 200) });
  }
  return [...suggestions.values()];
}

async function applyFactChanges(input: {
  tenantId: string;
  sourceId: string;
  documentId: string | null;
  origin: "material" | "quote";
  carrierId: string;
  facts: ResolvedFact[];
  areas: ResolvedArea[];
  validFrom: Date | null;
  validUntil: Date | null;
}) {
  const db = getDatabase();
  const keys = [...new Set(input.facts.flatMap((fact) => [fact.factKey, quoteFactKey(fact.factKey)]))];
  const stored = keys.length
    ? await db.select({ id: schema.operatorCatalogFacts.id, factKey: schema.operatorCatalogFacts.factKey, valueText: schema.operatorCatalogFacts.valueText, valueNumber: schema.operatorCatalogFacts.valueNumber, status: schema.operatorCatalogFacts.status })
      .from(schema.operatorCatalogFacts)
      .where(and(eq(schema.operatorCatalogFacts.tenantId, input.tenantId), inArray(schema.operatorCatalogFacts.factKey, keys), inArray(schema.operatorCatalogFacts.status, ["current", "pending_review"])))
    : [];
  const reviewAreas = new Set(input.areas.filter((area) => area.reviewRequired).map((area) => area.slug));
  const draftKeys = new Set(input.facts.filter((fact) => fact.draftPlan).map((fact) => fact.factKey));
  const actions = planFactChanges({
    incoming: input.facts,
    stored: stored.map((row) => ({ ...row, valueNumber: row.valueNumber === null ? null : Number(row.valueNumber), status: row.status as "current" | "pending_review" })),
    origin: input.origin,
    // A new (inactive) plan's facts wait with it: they go live when the plan is approved.
    reviewRequired: (areaSlug) => reviewAreas.has(areaSlug),
  }).map((action) => (action.kind === "insert_current" && input.origin === "material" && draftKeys.has(action.fact.factKey)
    ? { kind: "insert_pending" as const, fact: action.fact, replacesId: action.supersedesId, dropsPendingId: null }
    : action));

  const now = new Date();
  await db.transaction(async (tx) => {
    const touched = actions.filter((action) => action.kind === "touch").map((action) => action.storedId);
    if (touched.length) {
      // Confirmed again: it now points at the newest material that says it.
      await tx.update(schema.operatorCatalogFacts).set({ lastSeenAt: now, sourceId: input.sourceId, documentId: input.documentId }).where(and(eq(schema.operatorCatalogFacts.tenantId, input.tenantId), inArray(schema.operatorCatalogFacts.id, touched)));
    }
    const superseded = actions.flatMap((action) =>
      action.kind === "insert_current" && action.supersedesId ? [action.supersedesId]
        : action.kind === "insert_pending" && action.dropsPendingId ? [action.dropsPendingId] : []);
    if (superseded.length) {
      await tx.update(schema.operatorCatalogFacts).set({ status: "superseded", updatedAt: now }).where(and(eq(schema.operatorCatalogFacts.tenantId, input.tenantId), inArray(schema.operatorCatalogFacts.id, superseded)));
    }
    const inserts = actions.flatMap((action) => {
      if (action.kind === "touch") return [];
      const fact = action.fact;
      return [{
        id: randomUUID(),
        tenantId: input.tenantId,
        carrierId: input.carrierId,
        planId: fact.planId,
        areaSlug: fact.areaSlug,
        fieldKey: fact.fieldKey,
        valueText: fact.valueText.slice(0, 2000),
        valueNumber: fact.valueNumber === null ? null : fact.valueNumber.toFixed(2),
        unit: fact.unit,
        qualifiers: fact.qualifiers,
        factKey: fact.factKey,
        origin: input.origin,
        status: action.kind === "insert_pending" ? "pending_review" : "current",
        replacesFactId: action.kind === "insert_pending" ? action.replacesId : action.supersedesId,
        divergesFromFactId: action.kind === "insert_current" ? action.divergesFromId : null,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        sourceId: input.sourceId,
        documentId: input.documentId,
        page: fact.page,
        excerpt: fact.excerpt,
        lastSeenAt: now,
      }];
    });
    for (let start = 0; start < inserts.length; start += 500) {
      await tx.insert(schema.operatorCatalogFacts).values(inserts.slice(start, start + 500));
    }
  });
  return summarizeActions(actions);
}

async function storeSuggestions(tenantId: string, sourceId: string, suggestions: ReturnType<typeof collectSuggestions>) {
  if (!suggestions.length) return 0;
  await getDatabase().insert(schema.operatorCatalogSuggestions).values(suggestions.map((suggestion) => ({
    id: randomUUID(),
    tenantId,
    kind: suggestion.kind,
    areaSlug: suggestion.areaSlug,
    fieldKey: suggestion.fieldKey,
    label: suggestion.label.slice(0, 120),
    description: suggestion.description?.slice(0, 500) ?? null,
    example: suggestion.example?.slice(0, 300) ?? null,
    sourceId,
  }))).onConflictDoUpdate({
    target: [schema.operatorCatalogSuggestions.tenantId, schema.operatorCatalogSuggestions.kind, schema.operatorCatalogSuggestions.areaSlug, schema.operatorCatalogSuggestions.fieldKey],
    set: { occurrences: sql`${schema.operatorCatalogSuggestions.occurrences} + 1`, updatedAt: new Date() },
  });
  return suggestions.length;
}

export function chunkHash(text: string) {
  return createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex");
}

/**
 * The RAG side: tags the document and its chunks with the operator, type, plans
 * and areas, replaces the previous version of the same material (same
 * operator, type and subject) and computes embeddings only for text that is new:
 * a chunk identical to one already embedded reuses that vector.
 */
async function updateKnowledgeDocument(input: {
  tenantId: string;
  sourceId: string;
  carrier: NamedEntity;
  extraction: DocumentExtraction;
  planIds: string[];
  areas: string[];
  validFrom: Date | null;
  validUntil: Date | null;
}) {
  const db = getDatabase();
  const [document] = await db.select({ id: schema.knowledgeDocuments.id, title: schema.knowledgeDocuments.title, validFrom: schema.knowledgeDocuments.validFrom, validUntil: schema.knowledgeDocuments.validUntil })
    .from(schema.knowledgeDocuments)
    .where(and(eq(schema.knowledgeDocuments.tenantId, input.tenantId), eq(schema.knowledgeDocuments.sourceId, input.sourceId)))
    .limit(1);
  if (!document) return { documentId: null, replacedIds: [] as string[], embedded: 0, reused: 0 };

  const isQuote = input.extraction.documentType === "cotacao";
  const subject = input.extraction.subject || input.extraction.title || document.title;
  const documentKey = isQuote ? null : `${input.carrier.id}|${input.extraction.documentType}|${slugify(subject)}`;
  const now = new Date();
  await db.update(schema.knowledgeDocuments).set({
    title: (input.extraction.title || document.title).slice(0, 200),
    documentKey,
    // A quote carries the client's names and ages: its values feed the catalog, its text never reaches the assistant.
    status: isQuote ? "review" : "published",
    validFrom: input.validFrom ?? document.validFrom,
    validUntil: input.validUntil ?? document.validUntil,
    updatedAt: now,
  }).where(eq(schema.knowledgeDocuments.id, document.id));

  let replacedIds: string[] = [];
  if (documentKey) {
    const older = await db.update(schema.knowledgeDocuments)
      .set({ status: "archived", supersededBy: document.id, updatedAt: now })
      .where(and(
        eq(schema.knowledgeDocuments.tenantId, input.tenantId),
        eq(schema.knowledgeDocuments.documentKey, documentKey),
        eq(schema.knowledgeDocuments.status, "published"),
        ne(schema.knowledgeDocuments.id, document.id),
      ))
      .returning({ id: schema.knowledgeDocuments.id });
    replacedIds = older.map((row) => row.id);
  }

  const chunks = await db.select({ id: schema.knowledgeChunks.id, text: schema.knowledgeChunks.text, metadata: schema.knowledgeChunks.metadata, hasEmbedding: sql<boolean>`${schema.knowledgeChunks.embedding} is not null` })
    .from(schema.knowledgeChunks)
    .where(and(eq(schema.knowledgeChunks.tenantId, input.tenantId), eq(schema.knowledgeChunks.documentId, document.id)));
  const tags = { carrierId: input.carrier.id, carrierName: input.carrier.name, documentType: input.extraction.documentType, planIds: input.planIds, areas: input.areas };
  let embedded = 0;
  let reused = 0;
  const missing: Array<{ id: string; text: string }> = [];
  for (const chunk of chunks) {
    const hash = chunkHash(chunk.text);
    await db.update(schema.knowledgeChunks).set({ contentHash: hash, metadata: { ...(chunk.metadata as Record<string, unknown>), ...tags }, updatedAt: now }).where(eq(schema.knowledgeChunks.id, chunk.id));
    if (chunk.hasEmbedding || isQuote) continue;
    // Same text already embedded (an older version of this material): copy the vector, no new cost.
    const copied = await db.execute(sql`
      update knowledge_chunks target set embedding = donor.embedding
      from (
        select embedding from knowledge_chunks
        where tenant_id = ${input.tenantId} and content_hash = ${hash} and embedding is not null and id <> ${chunk.id}
        limit 1
      ) donor
      where target.id = ${chunk.id}
      returning target.id
    `);
    const copiedRows = Array.isArray(copied) ? copied : (copied as { rows?: unknown[] }).rows ?? [];
    if (copiedRows.length) reused += 1;
    else missing.push({ id: chunk.id, text: chunk.text });
  }
  if (missing.length) {
    const vectors = await embedTexts(missing.map((chunk) => `${input.carrier.name}. ${chunk.text}`));
    for (const [index, chunk] of missing.entries()) {
      const vector = vectors[index];
      if (!vector) continue;
      await db.update(schema.knowledgeChunks).set({ embedding: vector }).where(eq(schema.knowledgeChunks.id, chunk.id));
      embedded += 1;
    }
  }
  return { documentId: document.id, replacedIds, embedded, reused };
}

/**
 * What the previous version of this material said and the new one no longer
 * says (a plan taken off the table, a rule removed). Outside the review areas it
 * leaves the catalog; in them (prices, plans) it is flagged for the director.
 */
async function retireMissingFacts(input: { tenantId: string; replacedDocumentIds: string[]; areas: ResolvedArea[]; startedAt: Date }) {
  if (!input.replacedDocumentIds.length) return { retired: 0, missingForReview: 0 };
  const db = getDatabase();
  const reviewAreas = input.areas.filter((area) => area.reviewRequired).map((area) => area.slug);
  const missing = and(
    eq(schema.operatorCatalogFacts.tenantId, input.tenantId),
    inArray(schema.operatorCatalogFacts.documentId, input.replacedDocumentIds),
    eq(schema.operatorCatalogFacts.status, "current"),
    lt(schema.operatorCatalogFacts.lastSeenAt, input.startedAt),
  );
  const retired = await db.update(schema.operatorCatalogFacts)
    .set({ status: "superseded", updatedAt: new Date() })
    .where(and(missing, reviewAreas.length ? sql`${schema.operatorCatalogFacts.areaSlug} not in (${sql.join(reviewAreas.map((slug) => sql`${slug}`), sql`, `)})` : undefined))
    .returning({ id: schema.operatorCatalogFacts.id });
  const [flagged] = reviewAreas.length
    ? await db.select({ count: sql<number>`count(*)::int` }).from(schema.operatorCatalogFacts).where(and(missing, inArray(schema.operatorCatalogFacts.areaSlug, reviewAreas)))
    : [{ count: 0 }];
  return { retired: retired.length, missingForReview: Number(flagged?.count ?? 0) };
}

async function sourceText(tenantId: string, sourceId: string, extractedText: string | null) {
  if (extractedText?.trim()) return extractedText;
  // Material captured before migration 0213 kept its text only in the document.
  const [document] = await getDatabase().select({ content: schema.knowledgeDocuments.canonicalContent })
    .from(schema.knowledgeDocuments)
    .where(and(eq(schema.knowledgeDocuments.tenantId, tenantId), eq(schema.knowledgeDocuments.sourceId, sourceId)))
    .limit(1);
  return document?.content ?? "";
}

async function finish(sourceId: string, status: string, summary: CatalogSummary, extra: { documentType?: string | null; carrierId?: string | null } = {}) {
  await getDatabase().update(schema.knowledgeSources).set({
    catalogStatus: status,
    catalogSummary: summary,
    ...(extra.documentType !== undefined ? { documentType: extra.documentType } : {}),
    ...(extra.carrierId !== undefined ? { carrierId: extra.carrierId } : {}),
    updatedAt: new Date(),
  }).where(eq(schema.knowledgeSources.id, sourceId));
}

/**
 * Catalogs one operator file: reads it with the AI, finds the operator and the
 * plans, compares every fact with the catalog and writes only the differences,
 * then versions its RAG document. Safe to run twice: it claims the file first.
 */
export async function catalogOperatorSource(tenantId: string, sourceId: string) {
  const db = getDatabase();
  const [source] = await db.update(schema.knowledgeSources)
    .set({ catalogStatus: "processing", catalogAttempts: sql`${schema.knowledgeSources.catalogAttempts} + 1`, updatedAt: new Date() })
    .where(and(
      eq(schema.knowledgeSources.id, sourceId),
      eq(schema.knowledgeSources.tenantId, tenantId),
      eq(schema.knowledgeSources.category, OPERATOR_MATERIAL_CATEGORY),
      or(isNull(schema.knowledgeSources.catalogStatus), inArray(schema.knowledgeSources.catalogStatus, ["pending", "failed"])),
    ))
    .returning({ id: schema.knowledgeSources.id, extractedText: schema.knowledgeSources.extractedText, carrierId: schema.knowledgeSources.carrierId, attempts: schema.knowledgeSources.catalogAttempts });
  if (!source) return { status: "skipped" as const };

  try {
    const text = (await sourceText(tenantId, sourceId, source.extractedText)).trim();
    if (text.length < 80) {
      await finish(sourceId, "skipped", { reason: "Sem texto legível para catalogar." });
      return { status: "skipped" as const };
    }

    const startedAt = new Date();
    const [areas, carriers] = await Promise.all([loadCatalogAreas(tenantId), loadCarriers(tenantId)]);
    const forcedCarrier = source.carrierId ? carriers.find((carrier) => carrier.id === source.carrierId) ?? null : null;
    const { extraction, windows, truncated } = await extractDocument(tenantId, text, areas, carriers, forcedCarrier);

    const carrierName = forcedCarrier?.name ?? extraction.carrier?.name ?? null;
    if (!carrierName) {
      await finish(sourceId, "needs_review", { title: extraction.title, reason: "Operadora não identificada. Escolha a operadora e reprocesse.", windows, truncated }, { documentType: extraction.documentType });
      return { status: "needs_review" as const };
    }
    const carrier = forcedCarrier ?? await ensureCarrier(tenantId, carrierName, extraction.carrier?.ansCode, carriers);
    const { planOf, created } = await resolvePlans(tenantId, carrier, extraction, sourceId);
    const facts = resolveFacts(extraction, carrier.id, areas, planOf);
    const validFrom = parseDate(extraction.validFrom);
    const validUntil = plausibleValidUntil(parseDate(extraction.validUntil), startedAt);

    const planIds = [...new Set(facts.flatMap((fact) => (fact.planId ? [fact.planId] : [])))];
    const areaSlugs = [...new Set(facts.map((fact) => fact.areaSlug))];
    const knowledge = await updateKnowledgeDocument({ tenantId, sourceId, carrier, extraction, planIds, areas: areaSlugs, validFrom, validUntil });
    const changes = await applyFactChanges({
      tenantId, sourceId, documentId: knowledge.documentId,
      origin: extraction.documentType === "cotacao" ? "quote" : "material",
      carrierId: carrier.id, facts, areas, validFrom, validUntil,
    });
    const suggestions = await storeSuggestions(tenantId, sourceId, collectSuggestions(extraction, facts, areas));
    const removed = await retireMissingFacts({ tenantId, replacedDocumentIds: knowledge.replacedIds, areas, startedAt });

    const summary: CatalogSummary = {
      title: extraction.title,
      subject: extraction.subject,
      carrierName: carrier.name,
      plans: extraction.plans.map((plan) => plan.name).slice(0, 40),
      windows,
      truncated,
      facts: facts.length,
      ...changes,
      suggestions,
      newPlans: created,
      ...removed,
      replacedVersions: knowledge.replacedIds.length,
    };
    const status = changes.pendingReview > 0 || suggestions > 0 || created > 0 || removed.missingForReview > 0 ? "needs_review" : "cataloged";
    await finish(sourceId, status, summary, { documentType: extraction.documentType, carrierId: carrier.id });
    console.info("[operator-catalog] cataloged", { tenantId, sourceId, status, facts: facts.length, ...changes, embedded: knowledge.embedded, reused: knowledge.reused, ...removed, replacedVersions: knowledge.replacedIds.length });
    return { status: status as "needs_review" | "cataloged", summary };
  } catch (error) {
    if (error instanceof CatalogRetryLater) {
      // The AI budget of this minute is used: back to the queue without spending an attempt.
      await db.update(schema.knowledgeSources).set({ catalogStatus: "pending", catalogAttempts: sql`greatest(${schema.knowledgeSources.catalogAttempts} - 1, 0)`, updatedAt: new Date() }).where(eq(schema.knowledgeSources.id, sourceId));
      return { status: "retry_later" as const };
    }
    const message = error instanceof Error ? error.message.slice(0, 200) : "unknown";
    console.error("[operator-catalog] failed", { tenantId, sourceId, error: message });
    await finish(sourceId, "failed", { reason: "Não foi possível catalogar este arquivo agora. Ele será tentado de novo." });
    return { status: "failed" as const };
  }
}

/**
 * Coolify job (every 5 minutes): catalogs the files waiting, oldest first,
 * including material captured before the catalog existed. Bounded by count and
 * time so a long manual never holds the job.
 */
export async function runOperatorCatalogJob(options: { limit?: number; timeBudgetMs?: number } = {}) {
  const startedAt = Date.now();
  const limit = options.limit ?? 4;
  const timeBudget = options.timeBudgetMs ?? 240_000;
  const db = getDatabase();
  const waiting = await db.select({ id: schema.knowledgeSources.id, tenantId: schema.knowledgeSources.tenantId })
    .from(schema.knowledgeSources)
    .where(and(
      eq(schema.knowledgeSources.category, OPERATOR_MATERIAL_CATEGORY),
      eq(schema.knowledgeSources.status, "parsed"),
      or(
        isNull(schema.knowledgeSources.catalogStatus),
        eq(schema.knowledgeSources.catalogStatus, "pending"),
        and(eq(schema.knowledgeSources.catalogStatus, "failed"), lt(schema.knowledgeSources.catalogAttempts, MAX_ATTEMPTS)),
        // A run killed mid-way (deploy) leaves "processing": retried after 15 minutes.
        and(eq(schema.knowledgeSources.catalogStatus, "processing"), lt(schema.knowledgeSources.updatedAt, new Date(Date.now() - 15 * 60_000))),
      ),
    ))
    .orderBy(asc(schema.knowledgeSources.createdAt))
    .limit(limit);

  const result = { processed: 0, cataloged: 0, needsReview: 0, failed: 0, retryLater: 0, skipped: 0 };
  for (const row of waiting) {
    if (Date.now() - startedAt > timeBudget) break;
    // A stuck "processing" row is released before the claim.
    await db.update(schema.knowledgeSources).set({ catalogStatus: "pending" }).where(and(eq(schema.knowledgeSources.id, row.id), eq(schema.knowledgeSources.catalogStatus, "processing")));
    const outcome = await catalogOperatorSource(row.tenantId, row.id);
    result.processed += 1;
    if (outcome.status === "cataloged") result.cataloged += 1;
    else if (outcome.status === "needs_review") result.needsReview += 1;
    else if (outcome.status === "failed") result.failed += 1;
    else if (outcome.status === "retry_later") { result.retryLater += 1; break; }
    else result.skipped += 1;
  }
  return result;
}
