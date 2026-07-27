"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

const feedbackInput = z.object({
  leadId: z.string().uuid(),
  type: z.enum(["contacted", "no_answer", "callback_requested", "quote_sent", "documentation_pending", "negotiation", "no_interest", "invalid_number", "other"]),
  content: z.string().trim().max(1000).optional(),
  nextAction: z.string().trim().max(200).optional(),
  nextActionAt: z.string().optional(),
  checklistId: z.string().optional(),
  answers: z.string().optional(), // JSON string -> JSONB
});

export type LeadFeedbackState = { success?: boolean; error?: string };

export async function submitLeadFeedbackAction(_previous: LeadFeedbackState, formData: FormData): Promise<LeadFeedbackState> {
  const answersRaw = String(formData.get("answers") ?? "");
  let parsedAnswers: Record<string, string | number | boolean> | undefined;
  if (answersRaw) {
    try { parsedAnswers = JSON.parse(answersRaw); }
    catch { return { error: "Respostas do checklist inválidas." }; }
  }

  const parsed = feedbackInput.safeParse({
    leadId: formData.get("leadId"),
    type: formData.get("type"),
    content: String(formData.get("content") ?? "") || undefined,
    nextAction: String(formData.get("nextAction") ?? "") || undefined,
    nextActionAt: String(formData.get("nextActionAt") ?? "") || undefined,
    checklistId: String(formData.get("checklistId") ?? "") || undefined,
    answers: answersRaw || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informe um feedback válido." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId, status: schema.leads.status })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);
    if (!lead) return { error: "Lead não encontrado." };
    if (context.role === "broker" && lead.corretorId !== context.userId) return { error: "Você só pode atualizar seus próprios leads." };
    if (context.role === "manager" && lead.branchId !== context.branchId) return { error: "Este lead não pertence à sua unidade." };
    if (!lead.corretorId) return { error: "Este lead ainda não possui corretor responsável." };

    const [attempt] = await db.select({ id: schema.leadAssignmentAttempts.id })
      .from(schema.leadAssignmentAttempts)
      .where(and(eq(schema.leadAssignmentAttempts.leadId, lead.id), eq(schema.leadAssignmentAttempts.brokerId, lead.corretorId), eq(schema.leadAssignmentAttempts.status, "open")))
      .orderBy(desc(schema.leadAssignmentAttempts.sequence))
      .limit(1);
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.insert(schema.leadFeedbacks).values({
        id: randomUUID(), tenantId: context.tenantId, leadId: lead.id, brokerId: lead.corretorId!,
        type: parsed.data.type, content: parsed.data.content ?? null, nextAction: parsed.data.nextAction ?? null,
        nextActionAt: parsed.data.nextActionAt ? new Date(parsed.data.nextActionAt) : null,
        checklistId: parsed.data.checklistId ?? null,
        answers: parsedAnswers ?? null,
        createdAt: now,
      });
      if (attempt) await tx.update(schema.leadAssignmentAttempts).set({ status: "submitted", firstContactAt: now }).where(eq(schema.leadAssignmentAttempts.id, attempt.id));
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "note", conteudo: `Feedback registrado: ${parsed.data.type}${parsed.data.content ? ` — ${parsed.data.content}` : ""}` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_feedback", entidadeId: lead.id, acao: "feedback.registrado" });
    });
    revalidatePath(`/leads/${lead.id}`);
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível registrar o feedback." };
  }
}
