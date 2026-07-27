"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type QuoteActionState = { success?: boolean; error?: string; token?: string };

const createQuoteSchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string().trim().min(1).max(200),
  leadPhone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
  totalMonthly: z.coerce.number().positive().optional(),
  beneficiaryCount: z.coerce.number().int().positive().optional(),
  items: z.string().optional(),
  lineItems: z.string().optional(),
});

export async function createQuoteAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const parsed = createQuoteSchema.safeParse({
    leadId: formData.get("leadId"),
    leadName: formData.get("leadName"),
    leadPhone: formData.get("leadPhone") || undefined,
    notes: formData.get("notes") || undefined,
    totalMonthly: formData.get("totalMonthly") || undefined,
    beneficiaryCount: formData.get("beneficiaryCount") || undefined,
    items: formData.get("items") || undefined,
    lineItems: formData.get("lineItems") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [lead] = await db
      .select({ id: schema.leads.id, tenantId: schema.leads.tenantId, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { error: "Lead não encontrado." };
    if (context.role === "broker" && lead.corretorId !== context.userId) {
      return { error: "Você só pode gerar cotação para seus próprios leads." };
    }

    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    const quoteId = randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(schema.quotes).values({
        id: quoteId,
        tenantId: context.tenantId,
        leadId: lead.id,
        createdBy: context.userId,
        status: "draft",
        publicToken: token,
        leadName: parsed.data.leadName,
        leadPhone: parsed.data.leadPhone,
        totalMonthly: parsed.data.totalMonthly?.toString(),
        beneficiaryCount: parsed.data.beneficiaryCount,
        notes: parsed.data.notes,
      });

      if (parsed.data.items) {
        const items = JSON.parse(parsed.data.items) as Array<{ planId: string; monthlyPrice: number; recommended: boolean; snapshot?: Record<string, unknown> }>;
        if (items.length > 0) {
          await tx.insert(schema.quoteItems).values(
            items.map((item) => ({
              id: randomUUID(),
              quoteId,
              planId: item.planId,
              monthlyPrice: item.monthlyPrice.toString(),
              recommended: item.recommended,
              snapshot: item.snapshot ?? {},
            })),
          );
        }
      }

      if (parsed.data.lineItems) {
        const lineItems = JSON.parse(parsed.data.lineItems) as Array<{ beneficiaryId: string; planId: string; calculatedValue: number; ageAtQuote: number; snapshot?: Record<string, unknown> }>;
        if (lineItems.length > 0) {
          await tx.insert(schema.quoteLineItems).values(
            lineItems.map((item) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              quoteId,
              beneficiaryId: item.beneficiaryId,
              planId: item.planId,
              calculatedValue: item.calculatedValue.toString(),
              ageAtQuote: item.ageAtQuote,
              snapshot: item.snapshot ?? {},
            })),
          );
        }
      }

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "quote_generated",
        conteudo: `Cotação "${parsed.data.leadName}" criada com ${parsed.data.beneficiaryCount ?? "?"} beneficiários. Valor mensal: R$ ${parsed.data.totalMonthly?.toFixed(2) ?? "?"}.`,
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "quote",
        entidadeId: quoteId,
        acao: "criou",
      });
    });

    revalidatePath(`/leads/${lead.id}`);
    return { success: true, token };
  } catch (error) {
    console.error("Error creating quote:", error);
    return { error: "Erro ao criar cotação. Tente novamente." };
  }
}

export async function shareQuoteAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { error: "ID da cotação inválido." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [quote] = await db
      .select({ id: schema.quotes.id, tenantId: schema.quotes.tenantId, leadId: schema.quotes.leadId, leadBranchId: schema.leads.branchId, leadCorretorId: schema.leads.corretorId })
      .from(schema.quotes)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.quotes.leadId))
      .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, context.tenantId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!quote) return { error: "Cotação não encontrada." };

    if (context.role === "broker" && quote.leadCorretorId !== context.userId) return { error: "Voce so pode compartilhar cotacoes dos seus proprios leads." };
    if (context.role === "manager" && (!context.branchId || quote.leadBranchId !== context.branchId)) return { error: "Esta cotacao nao pertence a sua filial." };

    const now = new Date();
    const followUpDueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const followUpTitle = `Retorno da proposta (${quoteId.slice(0, 8)})`;

    await db.transaction(async (tx) => {
      await tx.update(schema.quotes).set({ sharedAt: now, status: "shared", updatedAt: now }).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, context.tenantId)));
      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(), leadId: quote.leadId, userId: context.userId, tipo: "quote_generated",
        conteudo: "Proposta compartilhada com o cliente. Retorno programado em 48 horas.",
        metadata: { quoteId, followUpDueAt: followUpDueAt.toISOString() },
      });

      const [existingTask] = await tx.select({ id: schema.leadTasks.id }).from(schema.leadTasks)
        .where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, quote.leadId), eq(schema.leadTasks.title, followUpTitle))).limit(1);
      if (existingTask) {
        await tx.update(schema.leadTasks).set({ dueAt: followUpDueAt, completedAt: null, assignedTo: quote.leadCorretorId, updatedAt: now })
          .where(and(eq(schema.leadTasks.id, existingTask.id), eq(schema.leadTasks.tenantId, context.tenantId)));
      } else {
        const taskId = randomUUID();
        await tx.insert(schema.leadTasks).values({
          id: taskId, tenantId: context.tenantId, leadId: quote.leadId, assignedTo: quote.leadCorretorId,
          createdBy: context.userId, title: followUpTitle,
          description: "Confirme se o cliente recebeu a proposta, tire duvidas e registre o proximo passo.",
          priority: "normal", dueAt: followUpDueAt, updatedAt: now,
        });
        if (quote.leadCorretorId) await tx.insert(schema.leadTaskAssignees).values({ id: randomUUID(), tenantId: context.tenantId, taskId, userId: quote.leadCorretorId });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_task", entidadeId: taskId, acao: "criou" });
      }
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "quote", entidadeId: quoteId, acao: "compartilhou" });
    });

    revalidatePath(`/leads/${quote.leadId}`);
    return { success: true };
  } catch (error) {
    console.error("Error sharing quote:", error);
    return { error: "Erro ao compartilhar cotação." };
  }
}

export async function deleteQuoteAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { error: "ID da cotação inválido." };

  try {
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [quote] = await db
      .select({ id: schema.quotes.id, tenantId: schema.quotes.tenantId, leadId: schema.quotes.leadId })
      .from(schema.quotes)
      .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, context.tenantId)))
      .limit(1);

    if (!quote) return { error: "Cotação não encontrada." };
    if (context.role === "broker") {
      return { error: "Corretores não podem excluir cotações." };
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.quoteLineItems).where(eq(schema.quoteLineItems.quoteId, quoteId));
      await tx.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quoteId));
      await tx.delete(schema.quotes).where(eq(schema.quotes.id, quoteId));
    });

    revalidatePath(`/leads/${quote.leadId}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting quote:", error);
    return { error: "Erro ao excluir cotação." };
  }
}

export type MessageTemplateState = { success?: boolean; error?: string };

const templateSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório.").max(100),
  category: z.string().trim().min(1).max(50),
  content: z.string().trim().min(1, "Conteúdo obrigatório.").max(4000),
  variables: z.string().optional(),
});

export async function createMessageTemplateAction(_previous: MessageTemplateState, formData: FormData): Promise<MessageTemplateState> {
  const parsed = templateSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    content: formData.get("content"),
    variables: formData.get("variables") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    const context = await getRequiredTenantContext();
    const variables = parsed.data.variables ? JSON.parse(parsed.data.variables) : [];

    await getDatabase().insert(schema.messageTemplates).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      name: parsed.data.name,
      category: parsed.data.category,
      content: parsed.data.content,
      variables,
      createdBy: context.userId,
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error creating template:", error);
    return { error: "Erro ao criar template." };
  }
}

export async function deleteMessageTemplateAction(_previous: MessageTemplateState, formData: FormData): Promise<MessageTemplateState> {
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { error: "ID do template inválido." };

  try {
    const context = await getRequiredTenantContext();

    await getDatabase()
      .delete(schema.messageTemplates)
      .where(and(eq(schema.messageTemplates.id, templateId), eq(schema.messageTemplates.tenantId, context.tenantId)));

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Error deleting template:", error);
    return { error: "Erro ao excluir template." };
  }
}
