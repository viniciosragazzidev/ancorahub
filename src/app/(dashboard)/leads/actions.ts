"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createManualLead } from "@/features/leads/manual-create";
import { canDeleteLead } from "@/features/leads/deletion-policy";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";

export type LeadCreateState = { duplicate?: { id: string; nome: string; createdAt: string; corretorNome: string | null }; error?: string };

export async function createManualLeadAction(_previous: LeadCreateState, formData: FormData): Promise<LeadCreateState> {
  let result: Awaited<ReturnType<typeof createManualLead>>;
  try {
    result = await createManualLead(Object.fromEntries(formData));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o lead." };
  }

  if (result.duplicate) return { duplicate: { id: result.duplicate.id, nome: result.duplicate.nome, createdAt: result.duplicate.createdAt.toISOString(), corretorNome: result.duplicate.corretorNome } };
  redirect(`/leads/${result.leadId}`);
}

export type LeadDeleteState = { error?: string };

export async function deleteLeadAction(_previous: LeadDeleteState, formData: FormData): Promise<LeadDeleteState> {
  const parsed = z.object({ leadId: z.string().uuid() }).safeParse({ leadId: formData.get("leadId") });
  if (!parsed.success) return { error: "Lead inválido." };

  try {
    const context = await getRequiredTenantContext();
    if (!canDeleteLead(context.role)) throw new AuthorizationError("Somente o Diretor pode excluir um lead.");
    const db = getDatabase();
    const now = new Date();
    const result = await db.transaction(async (tx) => {
      const [lead] = await tx.select({ id: schema.leads.id }).from(schema.leads)
        .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt))).limit(1);
      if (!lead) return false;
      await tx.update(schema.leads).set({ deletedAt: now, deletedBy: context.userId, updatedAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
      await tx.update(schema.aiConversations).set({ status: "CLOSED", automationState: "CLOSED", closedAt: now, updatedAt: now })
        .where(and(eq(schema.aiConversations.tenantId, context.tenantId), eq(schema.aiConversations.leadId, lead.id)));
      await tx.insert(schema.auditLogs).values({ id: crypto.randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "lead.soft_deleted_by_director" });
      return true;
    });
    if (!result) return { error: "Este lead já não está disponível." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível excluir o lead." };
  }

  revalidatePath("/leads");
  // The active route is the lead that has just been soft-deleted. Revalidating
  // it would render its `notFound()` boundary in the Server Action response,
  // preventing the dialog from receiving a completed response. A Server Action
  // redirect carries the fresh list view in that same response instead.
  redirect("/leads");
}
