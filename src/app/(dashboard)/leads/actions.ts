"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createManualLead } from "@/features/leads/manual-create";
import { canDeleteLead } from "@/features/leads/deletion-policy";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { buildLeadResourceScope, toEffectiveLeadAccessContext } from "@/features/leads/lead-authorization";
import { evaluateShadowAuthorization } from "@/shared/auth/shadow-mode";

export type LeadCreateState = {
  duplicate?: { id: string; nome: string; createdAt: string; corretorNome: string | null };
  error?: string;
  success?: boolean;
  mutationId?: string;
  leadId?: string;
};

export async function createManualLeadAction(_previous: LeadCreateState, formData: FormData): Promise<LeadCreateState> {
  let result: Awaited<ReturnType<typeof createManualLead>>;
  try {
    result = await createManualLead(Object.fromEntries(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o lead." };
  }

  if (result.duplicate) return { duplicate: { id: result.duplicate.id, nome: result.duplicate.nome, createdAt: result.duplicate.createdAt.toISOString(), corretorNome: result.duplicate.corretorNome } };
  return { success: true, mutationId: crypto.randomUUID(), leadId: result.leadId };
}

export type LeadDeleteState = { success?: boolean; error?: string; mutationId?: string };

export async function deleteLeadAction(_previous: LeadDeleteState, formData: FormData): Promise<LeadDeleteState> {
  const mutationId = crypto.randomUUID();
  const parsed = z.object({ leadId: z.string().uuid() }).safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { mutationId, error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const now = new Date();
    const accessContext = toEffectiveLeadAccessContext(context);

    const result = await db.transaction(async (tx) => {
      const [lead] = await tx.select({
        id: schema.leads.id,
        tenantId: schema.leads.tenantId,
        branchId: schema.leads.branchId,
        corretorId: schema.leads.corretorId,
      }).from(schema.leads)
        .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt))).limit(1);
      if (!lead) return false;

      const resourceScope = buildLeadResourceScope(lead);
      const legacyAllowed = canDeleteLead(context.role);

      await evaluateShadowAuthorization({
        operationKey: "lead.delete",
        legacyAllowed,
        context: accessContext,
        capability: "acessar_leads",
        resource: resourceScope,
      });

      if (!canDeleteLead(context.role) && !accessContext.canAccessAllUnits) {
        throw new AuthorizationError("Somente o Diretor pode excluir um lead.");
      }

      await tx.update(schema.leads).set({ deletedAt: now, deletedBy: context.userId, updatedAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)));
      await tx.update(schema.aiConversations).set({ status: "CLOSED", automationState: "CLOSED", closedAt: now, updatedAt: now })
        .where(and(eq(schema.aiConversations.tenantId, context.tenantId), eq(schema.aiConversations.leadId, lead.id)));
      await tx.insert(schema.auditLogs).values({ id: crypto.randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "lead.soft_deleted_by_director" });
      return true;
    });
    if (!result) return { mutationId, error: "Este lead já não está disponível." };
    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
    }).catch(() => undefined);
  } catch (error) {
    return { mutationId, error: error instanceof Error ? error.message : "Não foi possível excluir o lead." };
  }

  // Returning a normal result lets the client reset its pending state, close
  // the confirmation dialog, then navigate away from the now-deleted detail.
  return { success: true, mutationId };
}
