"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { analyzeLeadConversation } from "./analyzer";

const acceptTransitionSchema = z.object({
  leadId: z.string().uuid(),
  suggestedStatus: z.string().min(1),
});

export async function acceptAiSuggestedTransitionAction(input: {
  leadId: string;
  suggestedStatus: string;
}) {
  const parsed = acceptTransitionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos para aceitar transição." };
  }

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [lead] = await db
      .select({
        id: schema.leads.id,
        status: schema.leads.status,
        corretorId: schema.leads.corretorId,
        branchId: schema.leads.branchId,
        qualificationDetails: schema.leads.qualificationDetails,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) {
      return { success: false, error: "Lead não encontrado." };
    }

    if (context.role === "broker" && lead.corretorId !== context.userId) {
      return { success: false, error: "Você só pode alterar seus próprios leads." };
    }
    if (context.role === "manager" && lead.branchId !== context.branchId) {
      return { success: false, error: "Este lead não pertence à sua unidade." };
    }

    const now = new Date();
    const qualDetails = (lead.qualificationDetails as Record<string, any>) || {};

    await db.transaction(async (tx) => {
      // 1. Atualizar status do lead
      await tx
        .update(schema.leads)
        .set({
          status: parsed.data.suggestedStatus as any,
          stageEnteredAt: now,
          updatedAt: now,
          qualificationDetails: {
            ...qualDetails,
            aiPolicyResult: {
              ...(qualDetails.aiPolicyResult || {}),
              action: "ACCEPTED_BY_USER",
              acceptedAt: now.toISOString(),
              acceptedBy: context.userId,
            },
          },
        })
        .where(eq(schema.leads.id, lead.id));

      // 2. Registrar interação na timeline
      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "status_change",
        conteudo: `Sugestão da IA aceita: status alterado de '${lead.status}' para '${parsed.data.suggestedStatus}'.`,
        metadata: {
          source: "USER_ACCEPTED_AI_SUGGESTION",
          fromStatus: lead.status,
          toStatus: parsed.data.suggestedStatus,
          acceptedBy: context.userId,
        },
        createdAt: now,
      });

      // 3. Log de auditoria
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead_conversation_intelligence",
        entidadeId: lead.id,
        acao: `ai_suggestion.accepted:${parsed.data.suggestedStatus}`,
        createdAt: now,
      });
    });

    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/leads");
    revalidatePath("/conversas");

    return { success: true };
  } catch (error) {
    console.error("[conversation-intelligence] Erro ao aceitar transição sugerida:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar status do lead.",
    };
  }
}

export async function triggerManualConversationAnalysisAction(leadId: string) {
  try {
    const context = await getRequiredTenantContext();
    const result = await analyzeLeadConversation(leadId, context.tenantId);

    if (result.analyzed) {
      revalidatePath(`/leads/${leadId}`);
      return { success: true, assessment: result.assessment, policyResult: result.policyResult };
    }

    return { success: false, error: result.reason || "Não foi possível analisar a conversa." };
  } catch (error) {
    console.error("[conversation-intelligence] Erro na análise manual:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar inteligência da conversa.",
    };
  }
}
