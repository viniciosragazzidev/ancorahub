"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { recordStageChangeForLead, stageActorType } from "@/features/leads/stage-history";
import { generateCommissionSchedule } from "@/features/commissions/commission-rules-service";
import { claimProposalConversion, completeProposalConversion } from "./proposal-conversion-claim";
import { getSystemSetting } from "@/features/system-settings/queries";
import type { ProposalStatus } from "@/shared/db/schema";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { buildStrictRoleLeadScope } from "@/features/leads/strict-role-scope";
import { enqueueMetaConversionEvent } from "@/features/meta-ads/meta-conversion-service";
import { getProposalDefaults } from "./defaults";
import { notifyProposalOutcome } from "./proposal-outcome-notify";
import { buildProposalWhatsAppMessage, canSendProposalOnWhatsApp, defaultValidUntilInput, proposalPublicPath, validUntilFromDateInput } from "./proposal-rules";

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
    const validUntilStr = formData.get("validUntil")?.toString().trim();
    const notesInput = formData.get("notes");
    const documentIdsJson = formData.get("documentIds")?.toString() || "[]";

    if (!title || !leadId) {
      return { error: "Titulo e lead sao obrigatorios." };
    }

    // Validade e condições padrão da corretora entram quando o campo vem vazio (ou nem vem, como na criação pelo Sasá).
    const defaults = !validUntilStr || notesInput === null ? await getProposalDefaults(context.tenantId) : null;
    const validUntil = validUntilFromDateInput(validUntilStr || defaultValidUntilInput(defaults?.validDays ?? 0));
    if (!validUntil) {
      return { error: "Data de validade invalida." };
    }
    const notes = (notesInput === null ? defaults?.conditions ?? "" : notesInput.toString().trim()) || null;

    const documentIds = JSON.parse(documentIdsJson) as string[];

    const db = getDatabase();
    const leadScope = buildStrictRoleLeadScope(context, await resolveReportDataScope(context));

    // Verify lead exists and belongs to tenant
    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, leadId), leadScope))
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
        .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, context.tenantId), eq(schema.quotes.leadId, leadId)))
        .limit(1);

      if (!quote) return { error: "Cotação não encontrada para este lead." };
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

    const leadScope = buildStrictRoleLeadScope(context, await resolveReportDataScope(context));
    const [lead] = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, proposal.leadId), leadScope))
      .limit(1);
    if (!lead) return { success: false, error: "Acesso negado para esta proposta." };

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

    // Aprovada ou recusada pela operadora: avisa o corretor responsável (sino + push), sem travar a resposta.
    if (proposal.status !== newStatus && (newStatus === "aprovada" || newStatus === "perdida")) {
      void notifyProposalOutcome({ tenantId: context.tenantId, actorUserId: context.userId, proposal, newStatus })
        .catch((error) => console.error("[proposal-outcome] notify failed", { error: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar status da proposta.",
    };
  }
}

export type SendProposalWhatsAppResult =
  | { success: true; status: ProposalStatus; link: string }
  | { success: false; error: string; reason: "denied" | "status" | "no_link" | "no_channel" | "not_marked"; link?: string };

function publicBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://crm.ancorasaude.cloud").replace(/\/$/, "");
}

/**
 * "Enviar no WhatsApp": manda o link público e uma frase curta para a conversa do lead pelo mesmo envio das
 * conversas (`sendLeadMessageAction`: número oficial da corretora ou o WhatsApp conectado, com as mesmas regras de
 * quem pode responder e de opt-out) e só depois marca a proposta como enviada. Sem canal, devolve a causa e o link
 * para a tela oferecer "Copiar link".
 */
export async function sendProposalWhatsAppAction(proposalId: string): Promise<SendProposalWhatsAppResult> {
  try {
    await assertFeatureEnabled();
    const context = await getRequiredTenantContext();
    const db = getDatabase();

    const [proposal] = await db
      .select({
        id: schema.proposals.id,
        leadId: schema.proposals.leadId,
        quoteId: schema.proposals.quoteId,
        title: schema.proposals.title,
        status: schema.proposals.status,
        validUntil: schema.proposals.validUntil,
        createdBy: schema.proposals.createdBy,
        publicToken: schema.quotes.publicToken,
      })
      .from(schema.proposals)
      .leftJoin(schema.quotes, and(eq(schema.proposals.quoteId, schema.quotes.id), eq(schema.quotes.tenantId, schema.proposals.tenantId)))
      .where(and(eq(schema.proposals.id, proposalId), eq(schema.proposals.tenantId, context.tenantId)))
      .limit(1);
    if (!proposal) return { success: false, reason: "denied", error: "Proposta não encontrada." };

    const leadScope = buildStrictRoleLeadScope(context, await resolveReportDataScope(context));
    const [lead] = await db
      .select({ id: schema.leads.id, nome: schema.leads.nome })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, proposal.leadId), leadScope))
      .limit(1);
    if (!lead || (context.role === "broker" && proposal.createdBy !== context.userId)) {
      return { success: false, reason: "denied", error: "Acesso negado para esta proposta." };
    }
    if (!canSendProposalOnWhatsApp(proposal.status)) {
      return { success: false, reason: "status", error: "Só proposta em rascunho ou enviada vai pelo WhatsApp." };
    }

    const path = proposalPublicPath(proposal.publicToken);
    if (!path) {
      return { success: false, reason: "no_link", error: "Esta proposta não tem cotação vinculada, então ainda não tem link público." };
    }
    const link = `${publicBaseUrl()}${path}`;
    if (proposal.validUntil < new Date()) {
      return { success: false, reason: "status", error: "Esta proposta já venceu. Ajuste a validade antes de enviar.", link };
    }

    const [item] = proposal.quoteId
      ? await db
        .select({ snapshot: schema.quoteItems.snapshot })
        .from(schema.quoteItems)
        .where(eq(schema.quoteItems.quoteId, proposal.quoteId))
        .orderBy(desc(schema.quoteItems.recommended), asc(schema.quoteItems.createdAt))
        .limit(1)
      : [];
    const planName = (item?.snapshot as { planName?: unknown } | undefined)?.planName;

    const text = buildProposalWhatsAppMessage({
      leadName: lead.nome,
      planName: typeof planName === "string" ? planName : null,
      validUntil: proposal.validUntil,
      link,
    });
    // O mesmo envio das conversas (carregado só aqui: a cadeia do WhatsApp não pesa nas outras ações).
    const { sendLeadMessageAction } = await import("@/features/leads/actions/send-lead-message");
    const sent = await sendLeadMessageAction(lead.id, text, `proposal:${proposal.id}:${randomUUID()}`);
    if (!sent.success) {
      return { success: false, reason: "no_channel", error: sent.error ?? "Não deu para enviar pelo WhatsApp agora.", link };
    }

    try {
      const now = new Date();
      await db.transaction(async (tx) => {
        if (proposal.status === "rascunho") {
          await tx
            .update(schema.proposals)
            .set({ status: "enviada", updatedAt: now })
            .where(and(eq(schema.proposals.id, proposal.id), eq(schema.proposals.tenantId, context.tenantId)));
          // Mesmo retorno de 48 horas que a troca manual para "Enviada" cria.
          await tx.insert(schema.leadTasks).values({
            id: randomUUID(),
            tenantId: context.tenantId,
            leadId: proposal.leadId,
            title: `Retorno de proposta: ${proposal.title}`,
            dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
            priority: "urgent",
            assignedTo: proposal.createdBy,
            createdBy: context.userId,
            description: "Tarefa automatica criada apos o envio da proposta comercial.",
          });
        }
        if (proposal.quoteId) {
          await tx
            .update(schema.quotes)
            .set({ sharedAt: now, status: "shared", updatedAt: now })
            .where(and(eq(schema.quotes.id, proposal.quoteId), eq(schema.quotes.tenantId, context.tenantId)));
        }
        await tx.insert(schema.platformAuditLogs).values({
          id: randomUUID(),
          actorUserId: context.userId,
          action: "send_proposal_whatsapp",
          targetType: "proposal",
          targetId: proposal.id,
          metadata: { tenantId: context.tenantId, leadId: proposal.leadId, oldStatus: proposal.status, newStatus: "enviada" },
        });
      });
    } catch {
      return { success: false, reason: "not_marked", error: "A mensagem foi enviada, mas não deu para marcar a proposta como enviada.", link };
    }

    return { success: true, status: "enviada", link };
  } catch (error) {
    return {
      success: false,
      reason: "no_channel",
      error: error instanceof Error ? error.message : "Não deu para enviar pelo WhatsApp agora.",
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

    const leadScope = buildStrictRoleLeadScope(context, await resolveReportDataScope(context));
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
        stageEnteredAt: schema.leads.stageEnteredAt,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, proposal.leadId), leadScope))
      .limit(1);
    if (!lead) return { success: false, error: "Proposta nao encontrada." };

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

    // 4. Resolve the plan details after the lead has passed the role scope check.
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

    const conversion = await db.transaction(async (tx) => {
      const claim = await claimProposalConversion(tx, {
        tenantId: context.tenantId,
        leadId: lead.id,
        proposalId,
        convertedAt: now,
      });
      if (claim.kind !== "claimed") return claim;

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

      const proposalCompleted = await completeProposalConversion(tx, {
        tenantId: context.tenantId,
        leadId: lead.id,
        proposalId,
        saleId,
        convertedAt: now,
      });
      if (!proposalCompleted) throw new Error("Esta proposta mudou de estado. Atualize a tela e tente novamente.");

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
      // Histórico de etapas (05/11): proposta aprovada fecha o funil do lead.
      await recordStageChangeForLead(tx, { tenantId: context.tenantId, leadId: lead.id, fromStatus: lead.status, toStatus: "converted", changedAt: now, actorType: stageActorType({ role: context.role }), actorUserId: context.userId, reason: "Proposta convertida em venda", previousStageEnteredAt: lead.stageEnteredAt ?? null });

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

      return { kind: "claimed" as const };
    });

    if (conversion.kind === "already_converted") return { success: true, saleId: conversion.saleId };
    if (conversion.kind === "sale_exists") return { success: false, error: "Este lead já tem uma venda ativa registrada." };
    if (conversion.kind === "lead_not_found") return { success: false, error: "Proposta não encontrada." };
    if (conversion.kind === "conflict") return { success: false, error: "Esta proposta mudou de estado. Atualize a tela e tente novamente." };

    const { triggerInstantAutomation } = await import("@/features/automations/engine");
    void triggerInstantAutomation(context.tenantId, lead.id, "venda_realizada").catch(console.error);

    // Desfecho do fechamento (09/11): a venda de um lead em Documentação ou Em análise avisa a direção.
    const { notifyDirectorsClosingOutcome } = await import("@/features/leads/closing-outcome-notice");
    void notifyDirectorsClosingOutcome({
      tenantId: context.tenantId,
      leadId: lead.id,
      previousStatus: lead.status,
      newStatus: "converted",
      actorType: stageActorType({ role: context.role }),
      actorUserId: context.userId,
      changedAt: now,
      previousStageEnteredAt: lead.stageEnteredAt ?? null,
      saleValue: approvedValue,
    });

    // Venda para a direção no WhatsApp (DEC-179): aviso principal, ou a mensagem curta se o lead já estava Convertido.
    const { notifyDirectorsLeadConverted } = await import("@/features/leads/lead-converted-director-alert");
    void notifyDirectorsLeadConverted({
      tenantId: context.tenantId,
      leadId: lead.id,
      previousStatus: lead.status,
      newStatus: "converted",
      registration: true,
      previousStageEnteredAt: lead.stageEnteredAt ?? null,
      convertedAt: now,
      origin: { kind: "person", actorUserId: context.userId },
    });

    // Sequência de pós-venda (26/11): tarefas do corretor dono, depois do commit e sem lançar.
    void import("@/features/leads/post-sale-sequence")
      .then(({ startPostSaleSequence }) => startPostSaleSequence({ tenantId: context.tenantId, leadId: lead.id, convertedAt: now, actorUserId: context.userId }))
      .catch((error) => console.warn("[post-sale-sequence] import_failed", error instanceof Error ? error.message : error));

    // Conversions API for CRM: "Venda" (Lead Ads leads only, never throws).
    await enqueueMetaConversionEvent({ tenantId: context.tenantId, leadId: lead.id, stage: "sale", at: now });

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
  } catch {
    return { success: false, error: "Erro ao carregar dados do lead." };
  }
}
