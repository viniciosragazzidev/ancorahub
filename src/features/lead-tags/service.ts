import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";

import { AuthorizationError } from "@/shared/auth/errors";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { pickDistinctHue, QUEUE_HUE_MAX, QUEUE_HUE_MIN } from "@/features/lead-distribution/queue-color";

import { canManageLeadTags, canTagLead, normalizeLeadTagName, type LeadTag } from "./rules";

export async function listLeadTags(tenantId: string): Promise<LeadTag[]> {
  return getDatabase()
    .select({ id: schema.leadTags.id, name: schema.leadTags.name, colorHue: schema.leadTags.colorHue })
    .from(schema.leadTags)
    .where(eq(schema.leadTags.tenantId, tenantId))
    .orderBy(asc(schema.leadTags.name));
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
