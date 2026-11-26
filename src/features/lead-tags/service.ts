import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq, inArray, ne, sql } from "drizzle-orm";

import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { pickDistinctHue, QUEUE_HUE_MAX, QUEUE_HUE_MIN } from "@/features/lead-distribution/queue-color";

import {
  canManageLeadTags,
  canTagLead,
  LEAD_TAG_BULK_MAX,
  normalizeLeadTagName,
  planBulkLeadTag,
  planLeadTagMerge,
  type BulkLeadTagMode,
  type LeadTag,
  type LeadTagWithUsage,
} from "./rules";

export async function listLeadTags(tenantId: string): Promise<LeadTag[]> {
  return getDatabase()
    .select({ id: schema.leadTags.id, name: schema.leadTags.name, colorHue: schema.leadTags.colorHue })
    .from(schema.leadTags)
    .where(eq(schema.leadTags.tenantId, tenantId))
    .orderBy(asc(schema.leadTags.name));
}

/** The tag list with how many leads use each one (settings table). */
export async function listLeadTagsWithUsage(tenantId: string): Promise<LeadTagWithUsage[]> {
  const db = getDatabase();
  const [tags, usage] = await Promise.all([
    listLeadTags(tenantId),
    db.select({ tagId: schema.leadTagAssignments.tagId, value: count() })
      .from(schema.leadTagAssignments)
      .where(eq(schema.leadTagAssignments.tenantId, tenantId))
      .groupBy(schema.leadTagAssignments.tagId),
  ]);
  const byTag = new Map(usage.map((row) => [row.tagId, Number(row.value)]));
  return tags.map((tag) => ({ ...tag, leadCount: byTag.get(tag.id) ?? 0 }));
}

export type LeadTagMergeResult = { target: LeadTag; moved: number; alreadyTagged: number; leaving: number };

/**
 * Merges `sourceId` into `targetId`, both of the caller's company, in one transaction: assignments of leads
 * that only had the source move to the target, the ones that already had both are dropped (never a duplicate
 * lead+tag pair), and the source tag is deleted.
 */
export async function mergeLeadTags(context: TenantContext, input: { sourceId: string; targetId: string }): Promise<LeadTagMergeResult> {
  assertManager(context);
  if (!input.sourceId || !input.targetId || input.sourceId === input.targetId) throw new Error("Escolha outra etiqueta para juntar.");
  const tenantId = context.tenantId;
  return getDatabase().transaction(async (tx) => {
    const tags = await tx.select({ id: schema.leadTags.id, name: schema.leadTags.name, colorHue: schema.leadTags.colorHue })
      .from(schema.leadTags)
      .where(and(eq(schema.leadTags.tenantId, tenantId), inArray(schema.leadTags.id, [input.sourceId, input.targetId])));
    const source = tags.find((tag) => tag.id === input.sourceId);
    const target = tags.find((tag) => tag.id === input.targetId);
    if (!source || !target) throw new Error("Etiqueta não encontrada.");
    const assignments = await tx.select({ leadId: schema.leadTagAssignments.leadId, tagId: schema.leadTagAssignments.tagId })
      .from(schema.leadTagAssignments)
      .where(and(eq(schema.leadTagAssignments.tenantId, tenantId), inArray(schema.leadTagAssignments.tagId, [source.id, target.id])));
    const plan = planLeadTagMerge({
      sourceLeadIds: assignments.filter((row) => row.tagId === source.id).map((row) => row.leadId),
      targetLeadIds: assignments.filter((row) => row.tagId === target.id).map((row) => row.leadId),
    });
    if (plan.move.length) {
      await tx.update(schema.leadTagAssignments).set({ tagId: target.id })
        .where(and(eq(schema.leadTagAssignments.tenantId, tenantId), eq(schema.leadTagAssignments.tagId, source.id), inArray(schema.leadTagAssignments.leadId, plan.move)));
    }
    await tx.delete(schema.leadTagAssignments)
      .where(and(eq(schema.leadTagAssignments.tenantId, tenantId), eq(schema.leadTagAssignments.tagId, source.id)));
    const [removed] = await tx.delete(schema.leadTags)
      .where(and(eq(schema.leadTags.id, source.id), eq(schema.leadTags.tenantId, tenantId)))
      .returning({ id: schema.leadTags.id });
    if (!removed) throw new Error("Etiqueta não encontrada.");
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_tag", entidadeId: target.id, acao: "lead_tag.merged" });
    return { target, moved: plan.move.length, alreadyTagged: plan.alreadyTagged.length, leaving: plan.leaving };
  });
}

/** Each lead's tags, for lists (conversations, leads table). */
export async function getLeadTagsByLead(tenantId: string, leadIds: readonly string[]): Promise<Map<string, LeadTag[]>> {
  const byLead = new Map<string, LeadTag[]>();
  if (!leadIds.length) return byLead;
  const rows = await getDatabase()
    .select({ leadId: schema.leadTagAssignments.leadId, id: schema.leadTags.id, name: schema.leadTags.name, colorHue: schema.leadTags.colorHue })
    .from(schema.leadTagAssignments)
    .innerJoin(schema.leadTags, eq(schema.leadTags.id, schema.leadTagAssignments.tagId))
    .where(and(eq(schema.leadTagAssignments.tenantId, tenantId), inArray(schema.leadTagAssignments.leadId, [...leadIds])))
    .orderBy(asc(schema.leadTags.name));
  for (const row of rows) byLead.set(row.leadId, [...(byLead.get(row.leadId) ?? []), { id: row.id, name: row.name, colorHue: row.colorHue }]);
  return byLead;
}

function assertManager(context: TenantContext) {
  if (!canManageLeadTags(context.role)) throw new AuthorizationError("Apenas Diretores e Gestores criam e editam tags.");
}

async function assertNameFree(tenantId: string, name: string, exceptId?: string) {
  const [taken] = await getDatabase().select({ id: schema.leadTags.id }).from(schema.leadTags).where(and(
    eq(schema.leadTags.tenantId, tenantId),
    sql`lower(${schema.leadTags.name}) = lower(${name})`,
    exceptId ? ne(schema.leadTags.id, exceptId) : undefined,
  )).limit(1);
  if (taken) throw new Error("Já existe uma tag com esse nome.");
}

function validHue(hue: number | null | undefined) {
  return typeof hue === "number" && Number.isInteger(hue) && hue >= QUEUE_HUE_MIN && hue <= QUEUE_HUE_MAX ? hue : null;
}

export async function createLeadTag(context: TenantContext, input: { name: string; colorHue?: number | null }): Promise<LeadTag> {
  assertManager(context);
  const name = normalizeLeadTagName(input.name);
  if (!name) throw new Error("Dê um nome para a tag.");
  await assertNameFree(context.tenantId, name);
  const existing = await listLeadTags(context.tenantId);
  const colorHue = validHue(input.colorHue) ?? pickDistinctHue(existing.map((tag) => tag.colorHue));
  const tag = { id: randomUUID(), name, colorHue };
  const db = getDatabase();
  await db.insert(schema.leadTags).values({ ...tag, tenantId: context.tenantId, createdBy: context.userId });
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_tag", entidadeId: tag.id, acao: "lead_tag.created" });
  return tag;
}

export async function updateLeadTag(context: TenantContext, input: { id: string; name: string; colorHue: number }): Promise<LeadTag> {
  assertManager(context);
  const name = normalizeLeadTagName(input.name);
  if (!name) throw new Error("Dê um nome para a tag.");
  const colorHue = validHue(input.colorHue);
  if (colorHue === null) throw new Error("Cor inválida.");
  await assertNameFree(context.tenantId, name, input.id);
  const db = getDatabase();
  const [updated] = await db.update(schema.leadTags).set({ name, colorHue, updatedAt: new Date() })
    .where(and(eq(schema.leadTags.id, input.id), eq(schema.leadTags.tenantId, context.tenantId)))
    .returning({ id: schema.leadTags.id });
  if (!updated) throw new Error("Tag não encontrada.");
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_tag", entidadeId: input.id, acao: "lead_tag.updated" });
  return { id: input.id, name, colorHue };
}

/** Removes the tag from the list and from every lead that had it. */
export async function deleteLeadTag(context: TenantContext, tagId: string) {
  assertManager(context);
  const db = getDatabase();
  const [removed] = await db.delete(schema.leadTags)
    .where(and(eq(schema.leadTags.id, tagId), eq(schema.leadTags.tenantId, context.tenantId)))
    .returning({ id: schema.leadTags.id });
  if (!removed) throw new Error("Tag não encontrada.");
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_tag", entidadeId: tagId, acao: "lead_tag.deleted" });
}

export type BulkLeadTagResult = { tag: LeadTag; mode: BulkLeadTagMode; changed: number; unchanged: number; skipped: number; changedLeadIds: string[] };

/**
 * "Etiquetar" em lote (/leads): aplica ou tira uma etiqueta da empresa nos leads selecionados. Só leads da empresa
 * do usuário e no escopo dele mudam (`planBulkLeadTag`); nunca duplica o par lead+etiqueta.
 */
export async function bulkApplyLeadTag(context: TenantContext, input: { leadIds: readonly string[]; tagId: string; mode: BulkLeadTagMode }): Promise<BulkLeadTagResult> {
  const leadIds = [...new Set(input.leadIds.filter((id) => typeof id === "string" && id))];
  if (!leadIds.length) throw new Error("Selecione ao menos um lead.");
  if (leadIds.length > LEAD_TAG_BULK_MAX) throw new Error(`Selecione até ${LEAD_TAG_BULK_MAX} leads por vez.`);
  if (input.mode !== "add" && input.mode !== "remove") throw new Error("Escolha aplicar ou remover.");
  const tenantId = context.tenantId;
  const db = getDatabase();
  const [tag] = await db.select({ id: schema.leadTags.id, name: schema.leadTags.name, colorHue: schema.leadTags.colorHue })
    .from(schema.leadTags)
    .where(and(eq(schema.leadTags.tenantId, tenantId), eq(schema.leadTags.id, input.tagId)));
  if (!tag) throw new Error("Etiqueta não encontrada.");
  const leads = await db.select({ id: schema.leads.id, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.id, leadIds)));
  const tagged = await db.select({ leadId: schema.leadTagAssignments.leadId })
    .from(schema.leadTagAssignments)
    .where(and(eq(schema.leadTagAssignments.tenantId, tenantId), eq(schema.leadTagAssignments.tagId, tag.id), inArray(schema.leadTagAssignments.leadId, leadIds)));
  const plan = planBulkLeadTag({ context, requestedIds: leadIds, leads, taggedLeadIds: tagged.map((row) => row.leadId), mode: input.mode });
  if (!plan.change.length && plan.skipped === leadIds.length) throw new AuthorizationError("Você não pode alterar as etiquetas destes leads.");
  if (plan.change.length) {
    await db.transaction(async (tx) => {
      if (input.mode === "add") {
        await tx.insert(schema.leadTagAssignments)
          .values(plan.change.map((leadId) => ({ tenantId, leadId, tagId: tag.id, createdBy: context.userId })))
          .onConflictDoNothing();
      } else {
        await tx.delete(schema.leadTagAssignments)
          .where(and(eq(schema.leadTagAssignments.tenantId, tenantId), eq(schema.leadTagAssignments.tagId, tag.id), inArray(schema.leadTagAssignments.leadId, plan.change)));
      }
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_tag", entidadeId: tag.id, acao: input.mode === "add" ? `lead_tag.bulk_added:${plan.change.length}` : `lead_tag.bulk_removed:${plan.change.length}` });
    });
  }
  return { tag, mode: input.mode, changed: plan.change.length, unchanged: plan.unchanged.length, skipped: plan.skipped, changedLeadIds: plan.change };
}

/** The lead ends up with exactly `tagIds` (tags of the tenant only). */
export async function setLeadTags(context: TenantContext, input: { leadId: string; tagIds: readonly string[] }): Promise<LeadTag[]> {
  const db = getDatabase();
  const [lead] = await db.select({ corretorId: schema.leads.corretorId, branchId: schema.leads.branchId }).from(schema.leads)
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  if (!canTagLead(context, lead)) throw new AuthorizationError("Você não pode alterar as tags deste lead.");
  const wanted = [...new Set(input.tagIds)];
  const valid = wanted.length
    ? await db.select({ id: schema.leadTags.id }).from(schema.leadTags).where(and(eq(schema.leadTags.tenantId, context.tenantId), inArray(schema.leadTags.id, wanted)))
    : [];
  const tagIds = valid.map((tag) => tag.id);
  await db.transaction(async (tx) => {
    await tx.delete(schema.leadTagAssignments).where(and(
      eq(schema.leadTagAssignments.tenantId, context.tenantId),
      eq(schema.leadTagAssignments.leadId, input.leadId),
    ));
    if (tagIds.length) {
      await tx.insert(schema.leadTagAssignments).values(tagIds.map((tagId) => ({ tenantId: context.tenantId, leadId: input.leadId, tagId, createdBy: context.userId })));
    }
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: input.leadId, acao: "lead.tags_updated" });
  });
  return (await getLeadTagsByLead(context.tenantId, [input.leadId])).get(input.leadId) ?? [];
}
