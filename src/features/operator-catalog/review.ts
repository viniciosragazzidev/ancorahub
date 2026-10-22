import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

import { slugify } from "./taxonomy";

type Db = ReturnType<typeof getDatabase>;

function ageRange(band: string) {
  const open = band.match(/^(\d+)\+$/);
  if (open) return { minAge: Number(open[1]), maxAge: null };
  const range = band.match(/^(\d+)-(\d+)$/);
  return range ? { minAge: Number(range[1]), maxAge: Number(range[2]) } : { minAge: null, maxAge: null };
}

function tableLabel(qualifiers: Record<string, string>) {
  const parts = Object.entries(qualifiers).map(([key, value]) => `${key.replace(/_/g, " ")}: ${value.replace(/_/g, " ")}`);
  return parts.length ? parts.join(" · ").slice(0, 160) : "Tabela padrão";
}

/**
 * The approved prices of an active plan become its internal price tables (the
 * catalog the sales tools already read): one table per set of conditions
 * (accommodation, coparticipation, lives, region) and a new version only when
 * a price changed.
 */
export async function syncPlanPriceTables(db: Db, tenantId: string, planId: string, userId: string) {
  const [plan] = await db.select({ active: schema.tenantPrivatePlans.active }).from(schema.tenantPrivatePlans)
    .where(and(eq(schema.tenantPrivatePlans.id, planId), eq(schema.tenantPrivatePlans.tenantId, tenantId))).limit(1);
  if (!plan?.active) return 0;
  const facts = await db.select({ id: schema.operatorCatalogFacts.id, valueNumber: schema.operatorCatalogFacts.valueNumber, qualifiers: schema.operatorCatalogFacts.qualifiers, validFrom: schema.operatorCatalogFacts.validFrom })
    .from(schema.operatorCatalogFacts)
    .where(and(
      eq(schema.operatorCatalogFacts.tenantId, tenantId),
      eq(schema.operatorCatalogFacts.planId, planId),
      eq(schema.operatorCatalogFacts.areaSlug, "precos"),
      eq(schema.operatorCatalogFacts.fieldKey, "mensalidade"),
      eq(schema.operatorCatalogFacts.origin, "material"),
      eq(schema.operatorCatalogFacts.status, "current"),
      isNotNull(schema.operatorCatalogFacts.valueNumber),
    ));
  type PriceGroup = { qualifiers: Record<string, string>; rows: Map<string, number>; validFrom: Date | null; factIds: string[] };
  const groups = new Map<string, PriceGroup>();
  for (const fact of facts) {
    const { faixa_etaria: band, ...conditions } = (fact.qualifiers ?? {}) as Record<string, string>;
    if (!band) continue;
    const code = slugify(Object.entries(conditions).map(([key, value]) => `${key}_${value}`).join("_")) || "padrao";
    const group: PriceGroup = groups.get(code) ?? { qualifiers: conditions, rows: new Map(), validFrom: null, factIds: [] };
    group.rows.set(band, Number(fact.valueNumber));
    group.factIds.push(fact.id);
    if (fact.validFrom && (!group.validFrom || fact.validFrom > group.validFrom)) group.validFrom = fact.validFrom;
    groups.set(code, group);
  }

  let versions = 0;
  for (const [code, group] of groups) {
    const rows = [...group.rows.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }));
    const contentHash = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    let [table] = await db.select({ id: schema.tenantPrivatePriceTables.id }).from(schema.tenantPrivatePriceTables)
      .where(and(eq(schema.tenantPrivatePriceTables.tenantId, tenantId), eq(schema.tenantPrivatePriceTables.planId, planId), eq(schema.tenantPrivatePriceTables.code, code))).limit(1);
    if (!table) {
      const id = randomUUID();
      await db.insert(schema.tenantPrivatePriceTables).values({ id, tenantId, planId, code, name: tableLabel(group.qualifiers), createdBy: userId, metadata: { fromOperatorCatalog: true, qualifiers: group.qualifiers } });
      table = { id };
    }
    const [latest] = await db.select({ versionNumber: schema.tenantPrivateTableVersions.versionNumber, snapshot: schema.tenantPrivateTableVersions.snapshot })
      .from(schema.tenantPrivateTableVersions)
      .where(eq(schema.tenantPrivateTableVersions.priceTableId, table.id))
      .orderBy(desc(schema.tenantPrivateTableVersions.versionNumber)).limit(1);
    if ((latest?.snapshot as { contentHash?: string } | undefined)?.contentHash === contentHash) continue;

    const now = new Date();
    const versionId = randomUUID();
    await db.update(schema.tenantPrivateTableVersions).set({ status: "archived", effectiveTo: now, updatedAt: now })
      .where(and(eq(schema.tenantPrivateTableVersions.priceTableId, table.id), eq(schema.tenantPrivateTableVersions.status, "published")));
    await db.insert(schema.tenantPrivateTableVersions).values({
      id: versionId, tenantId, priceTableId: table.id, versionNumber: (latest?.versionNumber ?? 0) + 1, status: "published",
      effectiveFrom: group.validFrom ?? now, sourceLabel: "catalogo-operadoras",
      snapshot: { contentHash, factIds: group.factIds }, publishedBy: userId, publishedAt: now,
    });
    await db.insert(schema.tenantPrivatePriceRows).values(rows.map(([band, price]) => ({
      id: randomUUID(), tenantId, tableVersionId: versionId, ageBand: band, ...ageRange(band), monthlyPrice: price.toFixed(2), criteria: group.qualifiers,
    })));
    versions += 1;
  }
  return versions;
}

/** Approves pending facts: each one goes live and the value it replaces is kept as superseded. */
export async function approveFacts(tenantId: string, factIds: string[], userId: string) {
  if (!factIds.length) return { approved: 0, priceVersions: 0 };
  const db = getDatabase();
  const now = new Date();
  const pending = await db.select({ id: schema.operatorCatalogFacts.id, factKey: schema.operatorCatalogFacts.factKey, planId: schema.operatorCatalogFacts.planId, areaSlug: schema.operatorCatalogFacts.areaSlug })
    .from(schema.operatorCatalogFacts)
    .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), inArray(schema.operatorCatalogFacts.id, factIds), eq(schema.operatorCatalogFacts.status, "pending_review")));
  if (!pending.length) return { approved: 0, priceVersions: 0 };
  await db.transaction(async (tx) => {
    // Whatever is live for the same identity steps aside (not only the value seen at import time).
    await tx.update(schema.operatorCatalogFacts).set({ status: "superseded", updatedAt: now }).where(and(
      eq(schema.operatorCatalogFacts.tenantId, tenantId),
      inArray(schema.operatorCatalogFacts.factKey, pending.map((fact) => fact.factKey)),
      eq(schema.operatorCatalogFacts.status, "current"),
    ));
    await tx.update(schema.operatorCatalogFacts).set({ status: "current", reviewedBy: userId, reviewedAt: now, updatedAt: now })
      .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), inArray(schema.operatorCatalogFacts.id, pending.map((fact) => fact.id))));
  });
  let priceVersions = 0;
  for (const planId of new Set(pending.filter((fact) => fact.areaSlug === "precos" && fact.planId).map((fact) => fact.planId!))) {
    priceVersions += await syncPlanPriceTables(db, tenantId, planId, userId);
  }
  return { approved: pending.length, priceVersions };
}

export async function rejectFacts(tenantId: string, factIds: string[], userId: string) {
  if (!factIds.length) return 0;
  const rows = await getDatabase().update(schema.operatorCatalogFacts)
    .set({ status: "rejected", reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), inArray(schema.operatorCatalogFacts.id, factIds), eq(schema.operatorCatalogFacts.status, "pending_review")))
    .returning({ id: schema.operatorCatalogFacts.id });
  return rows.length;
}

/** A plan found in a material joins the catalog: active for the sales tools, with its pending facts approved. */
export async function approvePlan(tenantId: string, planId: string, userId: string, name?: string) {
  const db = getDatabase();
  const [plan] = await db.select({ id: schema.tenantPrivatePlans.id, metadata: schema.tenantPrivatePlans.metadata }).from(schema.tenantPrivatePlans)
    .where(and(eq(schema.tenantPrivatePlans.id, planId), eq(schema.tenantPrivatePlans.tenantId, tenantId))).limit(1);
  if (!plan) return null;
  await db.update(schema.tenantPrivatePlans).set({
    active: true,
    ...(name?.trim() ? { name: name.trim().slice(0, 160) } : {}),
    metadata: { ...(plan.metadata as Record<string, unknown>), catalogPending: false, approvedBy: userId, approvedAt: new Date().toISOString() },
    updatedAt: new Date(),
  }).where(eq(schema.tenantPrivatePlans.id, planId));
  const pending = await db.select({ id: schema.operatorCatalogFacts.id }).from(schema.operatorCatalogFacts)
    .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), eq(schema.operatorCatalogFacts.planId, planId), eq(schema.operatorCatalogFacts.status, "pending_review")));
  const facts = await approveFacts(tenantId, pending.map((fact) => fact.id), userId);
  // Prices approved before the plan was active only reach the tables now.
  const priceVersions = facts.priceVersions || await syncPlanPriceTables(db, tenantId, planId, userId);
  return { approved: facts.approved, priceVersions };
}

/** A plan misread from a material: archived with its pending facts rejected. */
export async function rejectPlan(tenantId: string, planId: string, userId: string) {
  const db = getDatabase();
  await db.update(schema.tenantPrivatePlans).set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.tenantPrivatePlans.id, planId), eq(schema.tenantPrivatePlans.tenantId, tenantId), eq(schema.tenantPrivatePlans.active, false)));
  const pending = await db.select({ id: schema.operatorCatalogFacts.id }).from(schema.operatorCatalogFacts)
    .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), eq(schema.operatorCatalogFacts.planId, planId), eq(schema.operatorCatalogFacts.status, "pending_review")));
  return rejectFacts(tenantId, pending.map((fact) => fact.id), userId);
}

/**
 * Something the previous version of a material said and the new one does not:
 * "remove" retires it, "keep" leaves it live and stops flagging it.
 */
export async function resolveMissingFacts(tenantId: string, factIds: string[], decision: "remove" | "keep", userId: string) {
  if (!factIds.length) return 0;
  const now = new Date();
  const rows = await getDatabase().update(schema.operatorCatalogFacts)
    .set(decision === "remove"
      ? { status: "superseded", reviewedBy: userId, reviewedAt: now, updatedAt: now }
      : { documentId: null, reviewedBy: userId, reviewedAt: now, lastSeenAt: now, updatedAt: now })
    .where(and(eq(schema.operatorCatalogFacts.tenantId, tenantId), inArray(schema.operatorCatalogFacts.id, factIds), eq(schema.operatorCatalogFacts.status, "current")))
    .returning({ id: schema.operatorCatalogFacts.id });
  return rows.length;
}

/** An approved area or field joins the catalog for every operator. */
export async function approveSuggestion(tenantId: string, suggestionId: string, userId: string, label?: string) {
  const db = getDatabase();
  const [suggestion] = await db.select().from(schema.operatorCatalogSuggestions)
    .where(and(eq(schema.operatorCatalogSuggestions.id, suggestionId), eq(schema.operatorCatalogSuggestions.tenantId, tenantId), eq(schema.operatorCatalogSuggestions.status, "pending"))).limit(1);
  if (!suggestion) return false;
  const finalLabel = label?.trim() || suggestion.label;
  const [area] = await db.select({ id: schema.operatorCatalogAreas.id, fields: schema.operatorCatalogAreas.fields }).from(schema.operatorCatalogAreas)
    .where(and(eq(schema.operatorCatalogAreas.tenantId, tenantId), eq(schema.operatorCatalogAreas.slug, suggestion.areaSlug))).limit(1);
  if (suggestion.kind === "area") {
    if (!area) await db.insert(schema.operatorCatalogAreas).values({ id: randomUUID(), tenantId, slug: suggestion.areaSlug, label: finalLabel, description: suggestion.description, fields: [], createdBy: userId });
  } else {
    const field = { key: suggestion.fieldKey, label: finalLabel, type: "text" };
    if (area) {
      const fields = Array.isArray(area.fields) ? area.fields as Array<{ key: string }> : [];
      if (!fields.some((existing) => existing.key === field.key)) {
        await db.update(schema.operatorCatalogAreas).set({ fields: sql`${schema.operatorCatalogAreas.fields} || ${JSON.stringify([field])}::jsonb`, updatedAt: new Date() }).where(eq(schema.operatorCatalogAreas.id, area.id));
      }
    } else {
      // A field for a system area: the row only carries the extra fields.
      await db.insert(schema.operatorCatalogAreas).values({ id: randomUUID(), tenantId, slug: suggestion.areaSlug, label: suggestion.areaSlug, fields: [field], createdBy: userId });
    }
  }
  await db.update(schema.operatorCatalogSuggestions).set({ status: "approved", label: finalLabel, reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(schema.operatorCatalogSuggestions.id, suggestion.id));
  return true;
}

export async function rejectSuggestion(tenantId: string, suggestionId: string, userId: string) {
  const rows = await getDatabase().update(schema.operatorCatalogSuggestions)
    .set({ status: "rejected", reviewedBy: userId, reviewedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.operatorCatalogSuggestions.id, suggestionId), eq(schema.operatorCatalogSuggestions.tenantId, tenantId)))
    .returning({ id: schema.operatorCatalogSuggestions.id });
  return rows.length > 0;
}
