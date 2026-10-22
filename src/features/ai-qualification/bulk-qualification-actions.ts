"use server";

import { randomUUID } from "node:crypto";
import { and, eq, gte, inArray, isNull, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { INITIAL_MESSAGE_FAILURE_NOTE_PREFIX } from "@/features/communication-channels/meta-delivery-failure";
import { startAiQualificationForLead } from "./service";

const bulkFilterSchema = z.object({
  filterType: z.enum(["all_unqualified", "new_leads", "unresponsive_24h", "first_message_failed", "custom_selection"]).default("all_unqualified"),
  leadIds: z.array(z.string().uuid()).optional(),
});

export type BulkQualificationFilter = z.infer<typeof bulkFilterSchema>;

const FIRST_MESSAGE_FAILED_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export async function getCandidateLeadsForBulkQualification(filterType: string = "all_unqualified") {
  const context = await getRequiredTenantContext();
  if (context.role !== "director" && context.role !== "manager") {
    throw new AuthorizationError("Apenas diretores e gestores podem realizar disparos em massa.");
  }
  const db = getDatabase();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const whereConditions = [
    eq(schema.leads.tenantId, context.tenantId),
    isNull(schema.leads.deletedAt),
  ];

  if (filterType === "first_message_failed") {
    // The first message never left because of a system error (no Meta code in the note) and
    // the lead has no message at all, so it has no chat to resume (22/10: empty operator variable).
    whereConditions.push(
      isNull(schema.leads.corretorId),
      notInArray(schema.leads.status, ["lost", "converted"]),
      gte(schema.leads.createdAt, new Date(now.getTime() - FIRST_MESSAGE_FAILED_LOOKBACK_MS)),
      sql`exists (select 1 from lead_interactions i where i.lead_id = "leads"."id" and i.conteudo like ${`${INITIAL_MESSAGE_FAILURE_NOTE_PREFIX}%`} and i.conteudo not like '%Motivo (%')`,
      sql`not exists (select 1 from whatsapp_messages m where m.tenant_id = "leads"."tenant_id" and m.lead_id = "leads"."id")`,
    );
    if (context.role !== "director") {
      if (!context.branchId) throw new AuthorizationError("Disparo disponível só para a unidade do gestor.");
      whereConditions.push(eq(schema.leads.branchId, context.branchId));
    }
  } else if (filterType === "new_leads") {
    whereConditions.push(eq(schema.leads.status, "new"));
  } else if (filterType === "unresponsive_24h") {
    whereConditions.push(
      or(
        eq(schema.leads.status, "new"),
        eq(schema.leads.status, "in_contact"),
        eq(schema.leads.status, "distributed")
      )!,
      sql`${schema.leads.createdAt} <= ${twentyFourHoursAgo}`
    );
  } else {
    // all_unqualified
    whereConditions.push(
      or(
        eq(schema.leads.status, "new"),
        eq(schema.leads.status, "in_contact"),
        eq(schema.leads.status, "distributed")
      )!
    );
  }

  const leads = await db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      createdAt: schema.leads.createdAt,
    })
    .from(schema.leads)
    .where(and(...whereConditions))
    .orderBy(schema.leads.createdAt)
    .limit(200);

  return leads.map((lead) => ({
    ...lead,
    createdAt: lead.createdAt.toISOString(),
  }));
}

export async function triggerBulkQualificationAction(input: BulkQualificationFilter) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Permissão negada. Apenas diretores e gestores podem realizar disparos de qualificação em massa." };
    }

    const parsed = bulkFilterSchema.parse(input);
    const db = getDatabase();

    let targetLeadIds: string[] = [];

    if (parsed.filterType === "custom_selection" && parsed.leadIds?.length) {
      targetLeadIds = parsed.leadIds;
    } else {
      const candidates = await getCandidateLeadsForBulkQualification(parsed.filterType);
      targetLeadIds = candidates.map((c) => c.id);
    }

    if (targetLeadIds.length === 0) {
      return { success: false, error: "Nenhum lead encontrado para os critérios selecionados." };
    }

    if (parsed.filterType === "first_message_failed") {
      // Out of "aguardando ação manual", or the lead would never reach a broker after qualifying.
      await db.update(schema.leads).set({ distributionStatus: "unassigned", qualificationStatus: "qualifying", qualificationState: "IN_PROGRESS", updatedAt: new Date() })
        .where(and(eq(schema.leads.tenantId, context.tenantId), inArray(schema.leads.id, targetLeadIds), isNull(schema.leads.corretorId)));
    }

    let successCount = 0;
    let failedCount = 0;

    for (const leadId of targetLeadIds) {
      try {
        const res = await startAiQualificationForLead({
          tenantId: context.tenantId,
          leadId,
          actorUserId: context.userId,
          force: true,
        });
        if (res.started) successCount++;
        else failedCount++;
      } catch {
        failedCount++;
      }
    }

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "ai_qualification_bulk",
      entidadeId: context.tenantId,
      acao: "ai_qualification.bulk_triggered",
    });


    return {
      success: true,
      totalProcessed: targetLeadIds.length,
      successCount,
      failedCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao disparar qualificação em massa.",
    };
  }
}
