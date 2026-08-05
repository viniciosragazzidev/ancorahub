"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { generateCommissionSchedule } from "@/features/commissions/commission-rules-service";
import { getSystemSetting } from "@/features/system-settings/queries";
import type { ProposalStatus } from "@/shared/db/schema";

async function assertFeatureEnabled() {
  const enabled = await getSystemSetting("feature_proposals_enabled");
  if (enabled === "false") {
    throw new Error("O modulo de propostas esta temporariamente desativado pelo super-admin.");
  }
}

function addYears(value: string, years: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export type ProposalActionState = { success?: boolean; error?: string; proposalId?: string };

export async function createProposalAction(
  _prevState: ProposalActionState,
  formData: FormData,
): Promise<ProposalActionState> {
  try {
    await assertFeatureEnabled();
    const context = await getRequiredTenantContext();

    const title = formData.get("title")?.toString().trim();
    const leadId = formData.get("leadId")?.toString();
    const quoteId = formData.get("quoteId")?.toString() || null;
    const validUntilStr = formData.get("validUntil")?.toString();
    const notes = formData.get("notes")?.toString().trim() || null;
    const documentIdsJson = formData.get("documentIds")?.toString() || "[]";

    if (!title || !leadId || !validUntilStr) {
      return { error: "Titulo, lead e data de validade sao obrigatorios." };
    }

    const validUntil = new Date(validUntilStr);
    if (isNaN(validUntil.getTime())) {
      return { error: "Data de validade invalida." };
    }

    const documentIds = JSON.parse(documentIdsJson) as string[];

    const db = getDatabase();

    // Verify lead exists and belongs to tenant
    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { error: "Lead nao encontrado." };

    let totalMonthly = "0.00";
    let beneficiaryCount = 0;

    if (quoteId) {
      const [quote] = await db
        .select({
          totalMonthly: schema.quotes.totalMonthly,
          beneficiaryCount: schema.quotes.beneficiaryCount,
        })
        .from(schema.quotes)
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, context.tenantId)))
        .limit(1);

      if (quote) {
        totalMonthly = quote.totalMonthly ? Number(quote.totalMonthly).toFixed(2) : "0.00";
        beneficiaryCount = quote.beneficiaryCount ?? 0;
      }
    }

    const proposalId = randomUUID();

    await db.insert(schema.proposals).values({
      id: proposalId,
      tenantId: context.tenantId,
      leadId,
      quoteId,
      title,
      status: "rascunho",
      version: 1,
      validUntil,
      notes,
      documentIds,
      createdBy: context.userId,
      totalMonthly,
      beneficiaryCount,
      leadName: lead.nome,
      leadPhone: lead.telefone,
    });

    // Audit log
    await db.insert(schema.platformAuditLogs).values({
      id: randomUUID(),
      actorUserId: context.userId,
      action: "create_proposal",
      targetType: "proposal",
      targetId: proposalId,
      metadata: {
        tenantId: context.tenantId,
        leadId,
        title,
      },
    });

    revalidatePath("/propostas");
    revalidatePath(`/leads/${leadId}`);
    return { success: true, proposalId };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Erro ao criar proposta.",
    };
  }
}

export async function updateProposalStatusAction(
  proposalId: string,
  newStatus: ProposalStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertFeatureEnabled();
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    // Fetch proposal
    const [proposal] = await db
      .select()
      .from(schema.proposals)
      .where(and(eq(schema.proposals.id, proposalId), eq(schema.proposals.tenantId, context.tenantId)))
      .limit(1);

    if (!proposal) return { success: false, error: "Proposta nao encontrada." };

    // Role restrictions (brokers can only modify their own proposals)
    if (context.role === "broker" && proposal.createdBy !== context.userId) {
      return { success: false, error: "Acesso negado para esta proposta." };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.proposals)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(schema.proposals.id, proposalId));

      // Audit log
      await tx.insert(schema.platformAuditLogs).values({
        id: randomUUID(),
        actorUserId: context.userId,
        action: `update_proposal_status_${newStatus}`,
        targetType: "proposal",
        targetId: proposalId,
        metadata: {
          tenantId: context.tenantId,
          oldStatus: proposal.status,
          newStatus,
        },
      });

      // Create return task automatically if status becomes "enviada"
      if (newStatus === "enviada") {
        const now = new Date();
        const followUpDueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        await tx.insert(schema.leadTasks).values({
          id: randomUUID(),
          tenantId: context.tenantId,
          leadId: proposal.leadId,
          title: `Retorno de proposta: ${proposal.title}`,
          dueAt: followUpDueAt,
          priority: "urgent",
          assignedTo: proposal.createdBy,
          createdBy: context.userId,
          description: `Tarefa automatica criada apos o envio da proposta comercial.`,
        });
      }
    });

    revalidatePath("/propostas");
    revalidatePath(`/leads/${proposal.leadId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar status da proposta.",
    };
  }
}

export type ConvertToSaleInput = {
  policyNumber: string;
  coverageStartDate: string; // YYYY-MM-DD
  contractTermMonths?: number;
  paymentMethod: "boleto" | "debito_automatico" | "cartao_credito" | "desconto_folha" | "outro";
  renewalType: "reajuste_operadora" | "portabilidade" | "manutencao" | "nova_contratacao";
  renewalContactPreference: string;
  notes?: string;
  carrierPlanId?: string; // Optional plan ID to override
};

export async function convertProposalToSaleAction(
  proposalId: string,
  input: ConvertToSaleInput,
): Promise<{ success: boolean; saleId?: string; error?: string }> {
  try {
    await assertFeatureEnabled();
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    // 1. Fetch proposal
    const [proposal] = await db
      .select()
      .from(schema.proposals)
      .where(and(eq(schema.proposals.id, proposalId), eq(schema.proposals.tenantId, context.tenantId)))
      .limit(1);

    if (!proposal) return { success: false, error: "Proposta nao encontrada." };

    // Role restrictions
    if (context.role === "broker" && proposal.createdBy !== context.userId) {
      return { success: false, error: "Acesso negado para esta proposta." };
    }

    // 2. Idempotency Check
    if (proposal.convertedSaleId) {
      return { success: true, saleId: proposal.convertedSaleId };
    }

    // 3. Validation Check
    if (proposal.status !== "aprovada") {
      return { success: false, error: "Apenas propostas com status 'aprovada' podem ser convertidas em venda." };
    }

    const now = new Date();
    if (proposal.validUntil < now) {
      return { success: false, error: "Esta proposta expirou e nao pode ser convertida em venda." };
    }

    // 4. Resolve Lead and Plan details
    const [lead] = await db
      .select({
        id: schema.leads.id,
        tenantId: schema.leads.tenantId,
        branchId: schema.leads.branchId,
        corretorId: schema.leads.corretorId,
        planId: schema.leads.planId,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, proposal.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) return { success: false, error: "Lead associado nao encontrado." };

    let resolvedPlanId = input.carrierPlanId || lead.planId || null;

    // If still no planId and quoteId exists, resolve first plan from quote items
    if (!resolvedPlanId && proposal.quoteId) {
      const [quoteItem] = await db
        .select({ planId: schema.quoteItems.planId })
        .from(schema.quoteItems)
        .where(eq(schema.quoteItems.quoteId, proposal.quoteId))
        .limit(1);
      if (quoteItem) resolvedPlanId = quoteItem.planId;
    }

    if (!resolvedPlanId) {
      return { success: false, error: "Nenhum plano de operadora associado a proposta ou ao lead." };
    }

    // Get carrier details
    const [planDetails] = await db
      .select({
        planName: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
        carrierId: schema.carriers.id,
      })
      .from(schema.carrierPlans)
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(eq(schema.carrierPlans.id, resolvedPlanId))
      .limit(1);

    const carrierName = planDetails?.carrierName || "";

    const coverageStartDateStr = input.coverageStartDate;
    const contractTermMonths = input.contractTermMonths ?? 12;
    const expirationDateStr = addMonths(coverageStartDateStr, contractTermMonths);
    const renewalWindowStartDateStr = subtractDays(expirationDateStr, 90);
    const contractAnniversaryStr = addYears(coverageStartDateStr, 1);

    const saleId = randomUUID();
    const clientId = randomUUID();
    const activeCustomerId = randomUUID();
    const approvedValue = Number(proposal.totalMonthly);

    const schedule = await generateCommissionSchedule(context.tenantId, saleId, resolvedPlanId, approvedValue);

    await db.transaction(async (tx) => {
      // Create Client (if not exists)
      await tx
        .insert(schema.clients)
        .values({
          id: clientId,
          tenantId: context.tenantId,
          leadId: lead.id,
          branchId: lead.branchId,
          corretorId: lead.corretorId ?? context.userId,
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email,
          convertedAt: now,
        })
        .onConflictDoNothing({ target: schema.clients.leadId });

      const [client] = await tx
        .select({ id: schema.clients.id })
        .from(schema.clients)
        .where(and(eq(schema.clients.leadId, lead.id), eq(schema.clients.tenantId, context.tenantId)))
        .limit(1);

      // Create Sale Record
      await tx.insert(schema.sales).values({
        id: saleId,
        tenantId: context.tenantId,
        leadId: lead.id,
        clientId: client?.id ?? clientId,
        brokerId: lead.corretorId ?? context.userId,
        carrierPlanId: resolvedPlanId,
        saleDate: now,
        saleValue: approvedValue.toFixed(2),
        approvedValue: approvedValue.toFixed(2),
        policyNumber: input.policyNumber,
        coverageStartDate: coverageStartDateStr,
        contractTermMonths,
        expirationDate: expirationDateStr,
        renewalWindowStartDate: renewalWindowStartDateStr,
        paymentMethod: input.paymentMethod,
        renewalType: input.renewalType,
        renewalContactPreference: input.renewalContactPreference,
        status: "active",
        createdBy: context.userId,
        notes: input.notes ?? null,
      });

      // Create Commission Schedules
      if (schedule.length) {
        await tx.insert(schema.commissionSchedule).values(schedule);
      }

      // Create Active Customers Record
      await tx.insert(schema.activeCustomers).values({
        id: activeCustomerId,
        tenantId: context.tenantId,
        saleId,
        clientId: client?.id ?? clientId,
        leadId: lead.id,
        brokerId: lead.corretorId ?? context.userId,
        branchId: lead.branchId,
        coverageStartDate: coverageStartDateStr,
        contractAnniversary: contractAnniversaryStr,
        contractTermMonths,
        expirationDate: expirationDateStr,
        renewalWindowStartDate: renewalWindowStartDateStr,
        renewalStatus: "pending_window",
        renewalNotes: input.notes ?? null,
      });

      // Schedule renewal reminders (T-90, T-60, T-30, T-15)
      const reminderTriggers = [
        { type: "t_90", days: 90 },
        { type: "t_60", days: 60 },
        { type: "t_30", days: 30 },
        { type: "t_15", days: 15 },
      ];

      for (const trigger of reminderTriggers) {
        const scheduledForStr = subtractDays(expirationDateStr, trigger.days);
        await tx.insert(schema.customerRenewalReminders).values({
          id: randomUUID(),
          tenantId: context.tenantId,
          activeCustomerId,
          saleId,
          clientId: client?.id ?? clientId,
          brokerId: lead.corretorId ?? context.userId,
          triggerType: trigger.type,
          scheduledFor: scheduledForStr,
          status: "pending",
        });
      }

      // Update Lead status to converted
      await tx
        .update(schema.leads)
        .set({ status: "converted", stageEnteredAt: now })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));

      // Add Lead interaction audit log
      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "status_change",
        conteudo: carrierName
          ? `Venda registrada com ${carrierName} via conversao de proposta. Contrato de ${contractTermMonths} meses com vencimento em ${new Date(expirationDateStr + "T12:00:00Z").toLocaleDateString("pt-BR")}.`
          : `Venda registrada via conversao de proposta. Contrato de ${contractTermMonths} meses com vencimento em ${new Date(expirationDateStr + "T12:00:00Z").toLocaleDateString("pt-BR")}.`,
        createdAt: now,
      });

      // Mark proposal as converted
      await tx
        .update(schema.proposals)
        .set({
          convertedAt: now,
          convertedSaleId: saleId,
          updatedAt: now,
        })
        .where(eq(schema.proposals.id, proposalId));

      // Audit Log
      await tx.insert(schema.platformAuditLogs).values({
        id: randomUUID(),
        actorUserId: context.userId,
        action: "convert_proposal_to_sale",
        targetType: "proposal",
        targetId: proposalId,
        metadata: {
          tenantId: context.tenantId,
          leadId: lead.id,
          saleId,
          policyNumber: input.policyNumber,
        },
      });
    });

    revalidatePath("/propostas");
    revalidatePath("/vendas");
    revalidatePath(`/leads/${lead.id}`);

    return { success: true, saleId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao converter proposta em venda.",
    };
  }
}

export async function getQuotesForLeadAction(leadId: string) {
  try {
    const { getQuotesForProposalCreation, getDocumentsForProposalCreation } = await import("./queries");
    const quotes = await getQuotesForProposalCreation(leadId);
    const docs = await getDocumentsForProposalCreation(leadId);
    return { success: true, quotes, docs };
  } catch (error) {
    return { success: false, error: "Erro ao carregar dados do lead." };
  }
}
