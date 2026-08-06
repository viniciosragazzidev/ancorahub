import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";

export const resetScopeValues = [
  "full_reset",
  "reset_messages_only",
  "reset_qualification_only",
  "reset_test_data",
] as const;

export type ResetScope = (typeof resetScopeValues)[number];

export const resetMemorySchema = z.object({
  leadId: z.string().min(1),
  scope: z.enum(resetScopeValues).default("full_reset"),
  reason: z.string().trim().min(3).max(250),
  preserveLeadRecord: z.boolean().default(true),
  preserveCommercialProfile: z.boolean().default(true),
});

export type ResetMemoryInput = z.infer<typeof resetMemorySchema>;

export async function resetQualificationSessionMemory(
  tenantId: string,
  actorUserId: string,
  input: ResetMemoryInput
) {
  const data = resetMemorySchema.parse(input);
  const db = getDatabase();
  const now = new Date();

  const [lead] = await db
    .select({ id: schema.leads.id, phone: schema.leads.telefone, name: schema.leads.nome })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, data.leadId), eq(schema.leads.tenantId, tenantId)))
    .limit(1);

  if (!lead) {
    throw new Error("Lead não encontrado para o tenant especificado.");
  }

  await db.transaction(async (tx) => {
    if (data.scope === "full_reset" || data.scope === "reset_qualification_only" || data.scope === "reset_test_data") {
      await tx
        .delete(schema.aiQualificationSessions)
        .where(
          and(
            eq(schema.aiQualificationSessions.tenantId, tenantId),
            eq(schema.aiQualificationSessions.leadId, data.leadId)
          )
        );

      await tx
        .update(schema.leads)
        .set({
          qualificationState: "NOT_STARTED",
          qualificationScore: 0,
          qualificationStatus: "pending",
          qualificationProfileKey: null,
          qualificationCompletedAt: null,
          qualificationDetails: null,
          updatedAt: now,
        })
        .where(and(eq(schema.leads.id, data.leadId), eq(schema.leads.tenantId, tenantId)));
    }

    if (data.scope === "full_reset" || data.scope === "reset_messages_only") {
      await tx
        .insert(schema.leadInteractions)
        .values({
          id: randomUUID(),
          leadId: data.leadId,
          userId: actorUserId,
          tipo: "note",
          conteudo: `[RESET DA IA] Memória da IA reiniciada por solicitação administrativa. Motivo: ${data.reason}`,
        });
    }

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorUserId,
      entidade: "lead_qualification_memory",
      entidadeId: data.leadId,
      acao: `qualification_memory.reset:${data.scope}`,
    });
  });

  return {
    success: true,
    leadId: data.leadId,
    phone: lead.phone,
    resetScope: data.scope,
    timestamp: now.toISOString(),
  };
}
