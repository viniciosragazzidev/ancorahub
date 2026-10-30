"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { AuthorizationService } from "@/shared/auth/authorization-service";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { buildLeadResourceScope, toEffectiveLeadAccessContext } from "@/features/leads/lead-authorization";
import { commercialValuesAuditMetadata, quoteCommercialValues } from "@/features/leads/commercial-values";
import { getCachedLegacyPlans } from "@/features/leads/reference-data";
import { getSystemSetting } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { listAvailableCatalogPlans } from "@/features/global-catalog/queries";
import { getDatabase, schema } from "@/shared/db";

export type QuoteActionState = { success?: boolean; error?: string; token?: string };

export type LeadQuoteListState = {
  quotes: Array<{
    id: string;
    status: string;
    totalMonthly: string | null;
    beneficiaryCount: number | null;
    publicToken: string;
    sharedAt: Date | null;
    createdAt: Date;
  }>;
  error?: string;
};

export async function listLeadQuotesAction(leadId: string): Promise<LeadQuoteListState> {
  const parsedLeadId = z.string().uuid().safeParse(leadId);
  if (!parsedLeadId.success) return { quotes: [], error: "Lead inválido." };

  try {
    if ((await getSystemSetting(FEATURE_FLAGS.LEAD_COMMERCIAL_VALUES.key)) === "false") return { quotes: [] };
    const context = await getRequiredTenantContext();
    const db = getDatabase();
    const [lead] = await db
      .select({ id: schema.leads.id, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.id, parsedLeadId.data),
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
      ))
      .limit(1);

    if (!lead) return { quotes: [], error: "Lead não encontrado." };
    const accessContext = toEffectiveLeadAccessContext(context);
    if (!AuthorizationService.can(accessContext, "acessar_leads", buildLeadResourceScope(lead))) {
      return { quotes: [], error: "Você não tem acesso às cotações deste lead." };
    }

    const quotes = await db
      .select({
        id: schema.quotes.id,
        status: schema.quotes.status,
        totalMonthly: schema.quotes.totalMonthly,
        beneficiaryCount: schema.quotes.beneficiaryCount,
        publicToken: schema.quotes.publicToken,
        sharedAt: schema.quotes.sharedAt,
        createdAt: schema.quotes.createdAt,
      })
      .from(schema.quotes)
      .where(and(
        eq(schema.quotes.tenantId, context.tenantId),
        eq(schema.quotes.leadId, lead.id),
      ))
      .orderBy(desc(schema.quotes.createdAt))
      .limit(10);

    return { quotes };
  } catch {
    return { quotes: [], error: "Não foi possível carregar as cotações agora." };
  }
}

const createQuoteSchema = z.object({
  leadId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
  beneficiaryCount: z.coerce.number().int().min(1).max(100),
  items: z.string().optional(),
  lineItems: z.string().optional(),
});

const quoteItemSchema = z.object({
  planId: z.string().trim().min(1).max(100),
  monthlyPrice: z.coerce.number().positive().max(9999999999.99),
  recommended: z.boolean().optional().default(false),
});
const quoteLineItemSchema = z.object({
  beneficiaryId: z.string().uuid(),
  planId: z.string().trim().min(1).max(100),
  calculatedValue: z.coerce.number().positive().max(9999999999.99),
  ageAtQuote: z.coerce.number().int().min(0).max(130),
});

export async function createQuoteAction(_previous: QuoteActionState, formData: FormData): Promise<QuoteActionState> {
  const parsed = createQuoteSchema.safeParse({
    leadId: formData.get("leadId"),
    notes: formData.get("notes") || undefined,
    beneficiaryCount: formData.get("beneficiaryCount") || undefined,
    items: formData.get("items") || undefined,
    lineItems: formData.get("lineItems") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    if ((await getSystemSetting(FEATURE_FLAGS.LEAD_COMMERCIAL_VALUES.key)) === "false") {
      return { error: "A criação de cotações está desativada." };
    }
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [lead] = await db
      .select({ id: schema.leads.id, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, nome: schema.leads.nome, telefone: schema.leads.telefone })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, parsed.data.leadId), eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt)))
      .limit(1);

    if (!lead) return { error: "Lead não encontrado." };
    const accessContext = toEffectiveLeadAccessContext(context);
    if (!AuthorizationService.can(accessContext, "acessar_leads", buildLeadResourceScope(lead))) {
      return { error: "Você não tem permissão para gerar cotação para este lead." };
    }

    let rawItems: unknown = [];
    let rawLineItems: unknown = [];
    try {
      rawItems = parsed.data.items ? JSON.parse(parsed.data.items) : [];
      rawLineItems = parsed.data.lineItems ? JSON.parse(parsed.data.lineItems) : [];
    } catch {
      return { error: "Confira os planos e valores da cotação." };
    }
    const itemsResult = z.array(quoteItemSchema).max(30).safeParse(rawItems);
    const lineItemsResult = z.array(quoteLineItemSchema).max(100).safeParse(rawLineItems);
    if (!itemsResult.success || !lineItemsResult.success) return { error: "Confira os planos e valores da cotação." };
    const quoteItems = itemsResult.data;
    const quoteLineItems = lineItemsResult.data;
    if (!quoteItems.length && !quoteLineItems.length) return { error: "Adicione ao menos um plano com valor mensal." };

    const [availablePlans, legacyPlans] = await Promise.all([
      listAvailableCatalogPlans(context),
      getCachedLegacyPlans(context.tenantId),
    ]);
    const planNames = new Map<string, string>([
      ...availablePlans.map((plan) => [plan.planId, plan.planName] as const),
      ...legacyPlans.map((plan) => [plan.id, plan.name] as const),
    ]);
    const selectedPlanIds = new Set([...quoteItems, ...quoteLineItems].map((item) => item.planId));
    if ([...selectedPlanIds].some((planId) => !planNames.has(planId))) {
      return { error: "Um dos planos não está mais disponível para este acesso." };
    }

    const beneficiaryIds = [...new Set(quoteLineItems.map((item) => item.beneficiaryId))];
    if (beneficiaryIds.length) {
      const beneficiaries = await db.select({ id: schema.leadBeneficiaries.id })
        .from(schema.leadBeneficiaries)
        .where(and(
          eq(schema.leadBeneficiaries.tenantId, context.tenantId),
          eq(schema.leadBeneficiaries.leadId, lead.id),
          inArray(schema.leadBeneficiaries.id, beneficiaryIds),
        ));
      if (beneficiaries.length !== beneficiaryIds.length) return { error: "Revise os beneficiários selecionados." };
    }

    const totalCents = [...quoteItems.map((item) => item.monthlyPrice), ...quoteLineItems.map((item) => item.calculatedValue)]
      .reduce((total, amount) => total + Math.round(amount * 100), 0);
    if (totalCents <= 0 || totalCents > 999999999999) return { error: "O total mensal da cotação está fora do limite permitido." };
    const totalMonthly = (totalCents / 100).toFixed(2);
    const beneficiaryCount = quoteLineItems.length
      ? new Set(quoteLineItems.map((item) => item.beneficiaryId)).size
      : parsed.data.beneficiaryCount;
    const commercialValues = quoteCommercialValues({ totalMonthly, beneficiaryCount });

    const token = randomUUID().replace(/-/g, "").slice(0, 16);
    const quoteId = randomUUID();

    await db.transaction(async (tx) => {
      const [currentLeadValues] = await tx.select({
        monthlyValue: schema.leads.monthlyValue,
        livesCount: schema.leads.livesCount,
      }).from(schema.leads).where(and(
        eq(schema.leads.id, lead.id),
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
      )).for("update").limit(1);
      if (!currentLeadValues) throw new Error("lead_not_found");

      await tx.insert(schema.quotes).values({
        id: quoteId,
        tenantId: context.tenantId,
        leadId: lead.id,
        createdBy: context.userId,
        status: "draft",
        publicToken: token,
        leadName: lead.nome,
        leadPhone: lead.telefone,
        totalMonthly,
        beneficiaryCount,
        notes: parsed.data.notes,
      });

      if (quoteItems.length > 0) {
          await tx.insert(schema.quoteItems).values(
            quoteItems.map((item) => ({
              id: randomUUID(),
              quoteId,
              planId: item.planId,
              monthlyPrice: item.monthlyPrice.toFixed(2),
              recommended: item.recommended,
              snapshot: { planName: planNames.get(item.planId) },
            })),
          );
      }

      if (quoteLineItems.length > 0) {
          await tx.insert(schema.quoteLineItems).values(
            quoteLineItems.map((item) => ({
              id: randomUUID(),
              tenantId: context.tenantId,
              quoteId,
              beneficiaryId: item.beneficiaryId,
              planId: item.planId,
              calculatedValue: item.calculatedValue.toFixed(2),
              ageAtQuote: item.ageAtQuote,
              snapshot: { planName: planNames.get(item.planId) },
            })),
          );
      }

      const [activeSale] = await tx.select({ id: schema.sales.id }).from(schema.sales).where(and(
        eq(schema.sales.tenantId, context.tenantId), eq(schema.sales.leadId, lead.id), eq(schema.sales.status, "active"),
      )).limit(1);
      const [activeProposal] = await tx.select({ id: schema.proposals.id }).from(schema.proposals).where(and(
        eq(schema.proposals.tenantId, context.tenantId),
        eq(schema.proposals.leadId, lead.id),
        inArray(schema.proposals.status, ["rascunho", "em_revisao", "enviada", "visualizada", "negociacao", "aprovada"]),
      )).limit(1);
      if (!activeSale && !activeProposal) {
        await tx.update(schema.leads).set({
          monthlyValue: commercialValues.monthlyValue,
          livesCount: commercialValues.livesCount,
          updatedAt: new Date(),
        }).where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id,
          acao: "lead.commercial_values_updated_from_quote",
          metadata: commercialValuesAuditMetadata({
            source: "quote",
            previous: currentLeadValues,
            next: commercialValues,
          }),
        });
      }

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "quote_generated",
        conteudo: `Cotação criada com ${beneficiaryCount} beneficiários. Valor mensal: R$ ${totalMonthly}.`,
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "quote",
        entidadeId: quoteId,
        acao: "criou",
      });
    });

    return { success: true, token };
  } catch {
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

    if (!AuthorizationService.can(
      toEffectiveLeadAccessContext(context),
      "acessar_leads",
      buildLeadResourceScope({ tenantId: context.tenantId, branchId: quote.leadBranchId, corretorId: quote.leadCorretorId }),
    )) return { error: "Você não tem acesso a esta cotação." };

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
      .select({
        id: schema.quotes.id,
        tenantId: schema.quotes.tenantId,
        leadId: schema.quotes.leadId,
        leadBranchId: schema.leads.branchId,
        leadCorretorId: schema.leads.corretorId,
      })
      .from(schema.quotes)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.quotes.leadId))
      .where(and(
        eq(schema.quotes.id, quoteId),
        eq(schema.quotes.tenantId, context.tenantId),
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
      ))
      .limit(1);

    if (!quote) return { error: "Cotação não encontrada." };
    if (context.role === "broker") {
      return { error: "Corretores não podem excluir cotações." };
    }
    if (!AuthorizationService.can(
      toEffectiveLeadAccessContext(context),
      "acessar_leads",
      buildLeadResourceScope({ tenantId: context.tenantId, branchId: quote.leadBranchId, corretorId: quote.leadCorretorId }),
    )) return { error: "Você não tem permissão para excluir esta cotação." };

    await db.transaction(async (tx) => {
      await tx.delete(schema.quoteLineItems).where(and(
        eq(schema.quoteLineItems.quoteId, quoteId),
        eq(schema.quoteLineItems.tenantId, context.tenantId),
      ));
      await tx.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quoteId));
      await tx.delete(schema.quotes).where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, context.tenantId)));
      await tx.insert(schema.auditLogs).values({
        id: randomUUID(), userId: context.userId, entidade: "quote", entidadeId: quoteId, acao: "excluiu",
      });
    });

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

    return { success: true };
  } catch (error) {
    console.error("Error deleting template:", error);
    return { error: "Erro ao excluir template." };
  }
}
