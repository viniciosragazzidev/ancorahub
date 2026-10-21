"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { changeLeadStatus } from "@/features/leads/change-lead-status";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";
import { analyzeLeadConversation } from "./analyzer";
import { canUndoAiMove, type AiAutoMove } from "./ai-move";
import { AI_STAGE_MODES, setAiStageMode } from "./stage-mode";

const leadIdSchema = z.string().uuid();
const acceptTransitionSchema = z.object({
  leadId: leadIdSchema,
  suggestedStatus: z.string().min(1),
});

type LeadForAi = {
  id: string;
  status: string;
  version: number;
  corretorId: string | null;
  branchId: string | null;
  qualificationDetails: unknown;
};

/** Loads the lead and checks scope on the server: the broker's own lead, a manager's unit, or a director. */
async function loadLeadInScope(context: TenantContext, leadId: string): Promise<LeadForAi | { error: string }> {
  const [lead] = await getDatabase()
    .select({
      id: schema.leads.id,
      status: schema.leads.status,
      version: schema.leads.version,
      corretorId: schema.leads.corretorId,
      branchId: schema.leads.branchId,
      qualificationDetails: schema.leads.qualificationDetails,
    })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
    .limit(1);
  if (!lead) return { error: "Lead não encontrado." };
  if (context.role === "broker" && lead.corretorId !== context.userId) return { error: "Você só pode alterar seus próprios leads." };
  if (context.role === "manager" && lead.branchId !== context.branchId) return { error: "Este lead não pertence à sua unidade." };
  if (context.role === "supervisor") return { error: "Peça ao corretor ou ao gestor para alterar a etapa." };
  return lead;
}

function aiDetails(lead: LeadForAi) {
  return (lead.qualificationDetails as Record<string, any> | null) ?? {};
}

async function saveAiDetails(leadId: string, details: Record<string, unknown>) {
  await getDatabase()
    .update(schema.leads)
    .set({ qualificationDetails: details, updatedAt: new Date() })
    .where(eq(schema.leads.id, leadId));
}

function revalidateLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/conversas");
}

function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("CONFLICT")) return "O lead mudou de etapa enquanto você decidia. Atualize a tela.";
  return message || fallback;
}

/** "Mover para X": the broker accepts the IA suggestion, through the same service as a manual change. */
export async function acceptAiSuggestedTransitionAction(input: { leadId: string; suggestedStatus: string }) {
  const parsed = acceptTransitionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos para aceitar transição." };

  try {
    const context = await getRequiredTenantContext();
    const lead = await loadLeadInScope(context, parsed.data.leadId);
    if ("error" in lead) return { success: false, error: lead.error };

    const details = aiDetails(lead);
    const target = parsed.data.suggestedStatus;
    const label = (status: string) => LEAD_STATUS_LABELS[status] ?? status;
    await changeLeadStatus(
      {
        leadId: lead.id,
        newStatus: target,
        motivoPerda: target === "lost" ? details.aiIntelligence?.lossReasonCode ?? "outro" : null,
        expectedVersion: lead.version,
      },
      context,
      {
        actorUserId: context.userId,
        expectedStatus: lead.status,
        auditAction: `ai_suggestion.accepted:${lead.status}->${target}`,
        interactionContent: `Sugestão da IA aceita: ${label(lead.status)} → ${label(target)}.`,
        interactionMetadata: { source: "USER_ACCEPTED_AI_SUGGESTION", fromStatus: lead.status, toStatus: target, acceptedBy: context.userId },
      },
    );
    await saveAiDetails(lead.id, {
      ...details,
      aiPolicyResult: { ...(details.aiPolicyResult ?? {}), action: "ACCEPTED_BY_USER", acceptedAt: new Date().toISOString(), acceptedBy: context.userId },
    });

    revalidateLead(lead.id);
    return { success: true };
  } catch (error) {
    console.error("[conversation-intelligence] Erro ao aceitar transição sugerida:", error);
    return { success: false, error: friendlyError(error, "Erro ao atualizar status do lead.") };
  }
}

/** "Recusar": hides the suggestion until the next analysis suggests something again. */
export async function rejectAiSuggestionAction(leadId: string) {
  if (!leadIdSchema.safeParse(leadId).success) return { success: false, error: "Lead inválido." };
  try {
    const context = await getRequiredTenantContext();
    const lead = await loadLeadInScope(context, leadId);
    if ("error" in lead) return { success: false, error: lead.error };

    const details = aiDetails(lead);
    const policy = details.aiPolicyResult ?? {};
    if (policy.action !== "SUGGEST") return { success: false, error: "Não há sugestão da IA para recusar." };

    const now = new Date();
    await saveAiDetails(lead.id, {
      ...details,
      aiPolicyResult: { ...policy, action: "REJECTED_BY_USER", rejectedAt: now.toISOString(), rejectedBy: context.userId },
    });
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_conversation_intelligence",
      entidadeId: lead.id,
      acao: `ai_suggestion.rejected:${policy.targetStatus ?? "?"}`,
      createdAt: now,
    });

    revalidateLead(lead.id);
    return { success: true };
  } catch (error) {
    console.error("[conversation-intelligence] Erro ao recusar sugestão:", error);
    return { success: false, error: friendlyError(error, "Não foi possível recusar a sugestão.") };
  }
}

/** "Desfazer": puts the lead back where it was before the IA moved it (up to 24h, while it is still there). */
export async function undoAiMoveAction(leadId: string) {
  if (!leadIdSchema.safeParse(leadId).success) return { success: false, error: "Lead inválido." };
  try {
    const context = await getRequiredTenantContext();
    const lead = await loadLeadInScope(context, leadId);
    if ("error" in lead) return { success: false, error: lead.error };

    const details = aiDetails(lead);
    const move = details.aiLastAutoMove as AiAutoMove | undefined;
    if (!canUndoAiMove(move, lead.status)) {
      return { success: false, error: "Esta mudança da IA não pode mais ser desfeita." };
    }

    const label = (status: string) => LEAD_STATUS_LABELS[status] ?? status;
    await changeLeadStatus(
      { leadId: lead.id, newStatus: move!.fromStatus, expectedVersion: lead.version },
      context,
      {
        actorUserId: context.userId,
        expectedStatus: move!.toStatus,
        // Going back to Novo/Distribuído is not in VALID_TRANSITIONS, but it is only a revert.
        skipTransitionCheck: true,
        auditAction: `ai_auto_move.undone:${move!.toStatus}->${move!.fromStatus}`,
        interactionContent: `Mudança da IA desfeita: ${label(move!.toStatus)} → ${label(move!.fromStatus)}.`,
        interactionMetadata: { source: "USER_UNDID_AI_MOVE", fromStatus: move!.toStatus, toStatus: move!.fromStatus, undoneBy: context.userId },
      },
    );
    await saveAiDetails(lead.id, {
      ...details,
      aiLastAutoMove: { ...move, undoneAt: new Date().toISOString(), undoneBy: context.userId },
    });

    revalidateLead(lead.id);
    return { success: true };
  } catch (error) {
    console.error("[conversation-intelligence] Erro ao desfazer mudança da IA:", error);
    return { success: false, error: friendlyError(error, "Não foi possível desfazer a mudança.") };
  }
}

/** Director's choice for the company: automatic, suggestions only, or off. */
export async function updateAiStageModeAction(mode: string) {
  const parsed = z.enum(AI_STAGE_MODES).safeParse(mode);
  if (!parsed.success) return { success: false, error: "Modo inválido." };
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director") return { success: false, error: "Só o diretor altera esta configuração." };
    await setAiStageMode(context.tenantId, parsed.data);
    await getDatabase().insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead_conversation_intelligence",
      entidadeId: context.tenantId,
      acao: `ai_stage_mode.updated:${parsed.data}`,
      createdAt: new Date(),
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("[conversation-intelligence] Erro ao salvar o modo da IA:", error);
    return { success: false, error: "Não foi possível salvar." };
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
