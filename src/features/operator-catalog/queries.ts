import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { OPERATOR_MATERIAL_CATEGORY } from "@/features/tenant-intelligence/rag/constants";
import { getDatabase, schema } from "@/shared/db";

import { embeddingsAvailable } from "./embeddings";
import { operatorFileStorageKey } from "./ingest";
import { loadCatalogAreas, type CatalogSummary } from "./service";

export type MaterialRow = {
  id: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  status: string;
  documentType: string | null;
  carrierId: string | null;
  carrierName: string | null;
  origin: "upload" | "whatsapp";
  hasOriginal: boolean;
  summary: CatalogSummary;
};

export async function listOperatorMaterials(tenantId: string): Promise<MaterialRow[]> {
  const rows = await getDatabase()
    .select({
      id: schema.knowledgeSources.id,
      fileName: schema.knowledgeSources.fileName,
      fileType: schema.knowledgeSources.fileType,
      fileUrl: schema.knowledgeSources.fileUrl,
      createdAt: schema.knowledgeSources.createdAt,
      status: schema.knowledgeSources.catalogStatus,
      documentType: schema.knowledgeSources.documentType,
      carrierId: schema.knowledgeSources.carrierId,
      carrierName: schema.tenantPrivateCarriers.name,
      summary: schema.knowledgeSources.catalogSummary,
    })
    .from(schema.knowledgeSources)
    .leftJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.knowledgeSources.carrierId))
    .where(and(eq(schema.knowledgeSources.tenantId, tenantId), eq(schema.knowledgeSources.category, OPERATOR_MATERIAL_CATEGORY), eq(schema.knowledgeSources.status, "parsed")))
    .orderBy(desc(schema.knowledgeSources.createdAt))
    .limit(1000);
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    fileType: row.fileType,
    createdAt: row.createdAt.toISOString(),
    status: row.status ?? "pending",
    documentType: row.documentType,
    carrierId: row.carrierId,
    carrierName: row.carrierName,
    origin: row.fileUrl.startsWith("waha-group:") ? "whatsapp" : "upload",
    hasOriginal: Boolean(operatorFileStorageKey(row.fileUrl)),
    summary: (row.summary ?? {}) as CatalogSummary,
  }));
}

export type FactRow = {
  id: string;
  carrierName: string;
  planId: string | null;
  planName: string | null;
  areaSlug: string;
  fieldKey: string;
  valueText: string;
  unit: string | null;
  qualifiers: Record<string, string>;
  validFrom: string | null;
  validUntil: string | null;
  origin: string;
  sourceId: string | null;
  sourceName: string | null;
  previousValue: string | null;
  page: number | null;
  excerpt: string | null;
};

const previous = alias(schema.operatorCatalogFacts, "previous_fact");

function factSelection() {
  return {
    id: schema.operatorCatalogFacts.id,
    carrierName: schema.tenantPrivateCarriers.name,
    planId: schema.operatorCatalogFacts.planId,
    planName: schema.tenantPrivatePlans.name,
    areaSlug: schema.operatorCatalogFacts.areaSlug,
    fieldKey: schema.operatorCatalogFacts.fieldKey,
    valueText: schema.operatorCatalogFacts.valueText,
    unit: schema.operatorCatalogFacts.unit,
    qualifiers: schema.operatorCatalogFacts.qualifiers,
    validFrom: schema.operatorCatalogFacts.validFrom,
    validUntil: schema.operatorCatalogFacts.validUntil,
    origin: schema.operatorCatalogFacts.origin,
    sourceId: schema.operatorCatalogFacts.sourceId,
    sourceName: schema.knowledgeSources.fileName,
    page: schema.operatorCatalogFacts.page,
    excerpt: schema.operatorCatalogFacts.excerpt,
  };
}

type FactSelectionRow = Omit<FactRow, "validFrom" | "validUntil" | "qualifiers" | "previousValue"> & { validFrom: Date | null; validUntil: Date | null; qualifiers: unknown; previousValue?: string | null };

function toFactRow(row: FactSelectionRow): FactRow {
  return {
    ...row,
    qualifiers: (row.qualifiers ?? {}) as Record<string, string>,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    previousValue: row.previousValue ?? null,
  };
}

export type ReviewQueue = {
  draftPlans: Array<{ id: string; name: string; carrierName: string; pendingFacts: number; sourceName: string | null }>;
  pendingFacts: FactRow[];
  missingFacts: FactRow[];
  suggestions: Array<{ id: string; kind: string; areaSlug: string; fieldKey: string; label: string; description: string | null; example: string | null; occurrences: number }>;
  divergences: FactRow[];
};

export async function getReviewQueue(tenantId: string): Promise<ReviewQueue> {
  const db = getDatabase();
  const base = () => db.select({ ...factSelection(), previousValue: previous.valueText })
    .from(schema.operatorCatalogFacts)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.operatorCatalogFacts.carrierId))
    .leftJoin(schema.tenantPrivatePlans, eq(schema.tenantPrivatePlans.id, schema.operatorCatalogFacts.planId))
    .leftJoin(schema.knowledgeSources, eq(schema.knowledgeSources.id, schema.operatorCatalogFacts.sourceId));

  const areas = await loadCatalogAreas(tenantId);
  const reviewAreas = areas.filter((area) => area.reviewRequired).map((area) => area.slug);

  const [pending, missing, divergences, plans, suggestions] = await Promise.all([
    base().leftJoin(previous, eq(previous.id, schema.operatorCatalogFacts.replacesFactId))
      .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), eq(schema.operatorCatalogFacts.status, "pending_review")))
      .orderBy(asc(schema.tenantPrivateCarriers.name), asc(schema.tenantPrivatePlans.name), asc(schema.operatorCatalogFacts.areaSlug))
      .limit(2000),
    // Live facts whose material was replaced by a version that no longer says them.
    base().leftJoin(previous, sql`false`)
      .innerJoin(schema.knowledgeDocuments, eq(schema.knowledgeDocuments.id, schema.operatorCatalogFacts.documentId))
      .where(and(
        eq(schema.operatorCatalogFacts.tenantId, tenantId),
        eq(schema.operatorCatalogFacts.status, "current"),
        eq(schema.knowledgeDocuments.status, "archived"),
        reviewAreas.length ? inArray(schema.operatorCatalogFacts.areaSlug, reviewAreas) : sql`false`,
      ))
      .limit(1000),
    base().leftJoin(previous, eq(previous.id, schema.operatorCatalogFacts.divergesFromFactId))
      .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), eq(schema.operatorCatalogFacts.status, "current"), eq(schema.operatorCatalogFacts.origin, "quote"), sql`${schema.operatorCatalogFacts.divergesFromFactId} is not null`))
      .orderBy(desc(schema.operatorCatalogFacts.createdAt))
      .limit(300),
    db.select({
      id: schema.tenantPrivatePlans.id,
      name: schema.tenantPrivatePlans.name,
      carrierName: schema.tenantPrivateCarriers.name,
      sourceName: schema.knowledgeSources.fileName,
      pendingFacts: sql<number>`(select count(*)::int from operator_catalog_facts f where f.plan_id = "tenant_private_plans"."id" and f.status = 'pending_review')`,
    })
      .from(schema.tenantPrivatePlans)
      .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.tenantPrivatePlans.carrierId))
      .leftJoin(schema.knowledgeSources, sql`${schema.knowledgeSources.id} = ${schema.tenantPrivatePlans.metadata}->>'firstSourceId'`)
      .where(and(
        eq(schema.tenantPrivatePlans.tenantId, tenantId),
        eq(schema.tenantPrivatePlans.active, false),
        isNull(schema.tenantPrivatePlans.archivedAt),
        sql`(${schema.tenantPrivatePlans.metadata}->>'catalogPending')::boolean is true`,
      ))
      .orderBy(asc(schema.tenantPrivateCarriers.name), asc(schema.tenantPrivatePlans.name)),
    db.select({
      id: schema.operatorCatalogSuggestions.id,
      kind: schema.operatorCatalogSuggestions.kind,
      areaSlug: schema.operatorCatalogSuggestions.areaSlug,
      fieldKey: schema.operatorCatalogSuggestions.fieldKey,
      label: schema.operatorCatalogSuggestions.label,
      description: schema.operatorCatalogSuggestions.description,
      example: schema.operatorCatalogSuggestions.example,
      occurrences: schema.operatorCatalogSuggestions.occurrences,
    })
      .from(schema.operatorCatalogSuggestions)
      .where(and(eq(schema.operatorCatalogSuggestions.tenantId, tenantId), eq(schema.operatorCatalogSuggestions.status, "pending")))
      .orderBy(desc(schema.operatorCatalogSuggestions.occurrences)),
  ]);

  return {
    draftPlans: plans.map((plan) => ({ ...plan, pendingFacts: Number(plan.pendingFacts) })),
    pendingFacts: pending.map(toFactRow),
    missingFacts: missing.map(toFactRow),
    suggestions,
    divergences: divergences.map(toFactRow),
  };
}

export type CarrierOverview = {
  id: string;
  name: string;
  activePlans: number;
  draftPlans: number;
  facts: number;
  areas: Array<{ slug: string; facts: number }>;
  updatedAt: string | null;
};

export async function getCatalogOverview(tenantId: string) {
  const db = getDatabase();
  const [carriers, plans, facts, areas, semanticSearch] = await Promise.all([
    db.select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name })
      .from(schema.tenantPrivateCarriers)
      .where(and(eq(schema.tenantPrivateCarriers.tenantId, tenantId), isNull(schema.tenantPrivateCarriers.archivedAt)))
      .orderBy(asc(schema.tenantPrivateCarriers.name)),
    db.select({ carrierId: schema.tenantPrivatePlans.carrierId, active: schema.tenantPrivatePlans.active, count: sql<number>`count(*)::int` })
      .from(schema.tenantPrivatePlans)
      .where(and(eq(schema.tenantPrivatePlans.tenantId, tenantId), isNull(schema.tenantPrivatePlans.archivedAt)))
      .groupBy(schema.tenantPrivatePlans.carrierId, schema.tenantPrivatePlans.active),
    db.select({ carrierId: schema.operatorCatalogFacts.carrierId, areaSlug: schema.operatorCatalogFacts.areaSlug, count: sql<number>`count(*)::int`, updatedAt: sql<string>`max(${schema.operatorCatalogFacts.lastSeenAt})` })
      .from(schema.operatorCatalogFacts)
      .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), eq(schema.operatorCatalogFacts.status, "current"), eq(schema.operatorCatalogFacts.origin, "material")))
      .groupBy(schema.operatorCatalogFacts.carrierId, schema.operatorCatalogFacts.areaSlug),
    loadCatalogAreas(tenantId),
    embeddingsAvailable(),
  ]);
  const overview: CarrierOverview[] = carriers.map((carrier) => {
    const carrierFacts = facts.filter((row) => row.carrierId === carrier.id);
    const updated = carrierFacts.map((row) => row.updatedAt).filter(Boolean).sort().at(-1) ?? null;
    return {
      id: carrier.id,
      name: carrier.name,
      activePlans: Number(plans.find((row) => row.carrierId === carrier.id && row.active)?.count ?? 0),
      draftPlans: Number(plans.find((row) => row.carrierId === carrier.id && !row.active)?.count ?? 0),
      facts: carrierFacts.reduce((total, row) => total + Number(row.count), 0),
      areas: carrierFacts.map((row) => ({ slug: row.areaSlug, facts: Number(row.count) })),
      updatedAt: updated ? new Date(updated).toISOString() : null,
    };
  });
  return {
    carriers: overview,
    areas: areas.map((area) => ({ slug: area.slug, label: area.label, description: area.description, fields: area.fields.map((field) => ({ key: field.key, label: field.label })), custom: Boolean(area.custom), reviewRequired: Boolean(area.reviewRequired) })),
    semanticSearch,
  };
}

/** Live facts of one operator (and one area), for the catalog drawer. */
export async function listCarrierFacts(tenantId: string, carrierId: string, areaSlug?: string | null): Promise<FactRow[]> {
  const rows = await getDatabase().select(factSelection())
    .from(schema.operatorCatalogFacts)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.operatorCatalogFacts.carrierId))
    .leftJoin(schema.tenantPrivatePlans, eq(schema.tenantPrivatePlans.id, schema.operatorCatalogFacts.planId))
    .leftJoin(schema.knowledgeSources, eq(schema.knowledgeSources.id, schema.operatorCatalogFacts.sourceId))
    .where(and(
      eq(schema.operatorCatalogFacts.tenantId, tenantId),
      eq(schema.operatorCatalogFacts.carrierId, carrierId),
      eq(schema.operatorCatalogFacts.status, "current"),
      ...(areaSlug ? [eq(schema.operatorCatalogFacts.areaSlug, areaSlug)] : []),
    ))
    .orderBy(asc(schema.tenantPrivatePlans.name), asc(schema.operatorCatalogFacts.areaSlug), asc(schema.operatorCatalogFacts.fieldKey))
    .limit(3000);
  return rows.map(toFactRow);
}

/** Facts read from one file (the material drawer), any status. */
export async function listSourceFacts(tenantId: string, sourceId: string): Promise<Array<FactRow & { status: string }>> {
  const rows = await getDatabase().select({ ...factSelection(), status: schema.operatorCatalogFacts.status })
    .from(schema.operatorCatalogFacts)
    .innerJoin(schema.tenantPrivateCarriers, eq(schema.tenantPrivateCarriers.id, schema.operatorCatalogFacts.carrierId))
    .leftJoin(schema.tenantPrivatePlans, eq(schema.tenantPrivatePlans.id, schema.operatorCatalogFacts.planId))
    .leftJoin(schema.knowledgeSources, eq(schema.knowledgeSources.id, schema.operatorCatalogFacts.sourceId))
    .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), eq(schema.operatorCatalogFacts.sourceId, sourceId)))
    .orderBy(asc(schema.operatorCatalogFacts.areaSlug), asc(schema.tenantPrivatePlans.name))
    .limit(2000);
  return rows.map((row) => ({ ...toFactRow(row), status: row.status }));
}

export async function listCarriersForSelect(tenantId: string) {
  return getDatabase().select({ id: schema.tenantPrivateCarriers.id, name: schema.tenantPrivateCarriers.name })
    .from(schema.tenantPrivateCarriers)
    .where(and(eq(schema.tenantPrivateCarriers.tenantId, tenantId), isNull(schema.tenantPrivateCarriers.archivedAt)))
    .orderBy(asc(schema.tenantPrivateCarriers.name));
}
