"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { recordStageChangeForLead, stageActorType } from "@/features/leads/stage-history";
import { generateCommissionSchedule } from "@/features/commissions/commission-rules-service";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { publishDomainInvalidation } from "@/features/notifications/realtime-sync";
import { buildCustomerRenewalStatusScope } from "./customer-renewal-scope";
import { enqueueMetaConversionEvent } from "@/features/meta-ads/meta-conversion-service";
import { aiSaleRegistrationPending } from "@/features/conversation-intelligence/sale-detection-core";

const registerSaleInput = z.object({
  leadId: z.string().min(1),
  policyNumber: z.string().trim().min(1, "Informe o número da apólice.").max(120),
  coverageStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de vigência válida."),
  contractTermMonths: z.coerce.number().int().min(1).max(120).default(12),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de vencimento.").optional(),
  paymentMethod: z.enum(schema.paymentMethodValues).default("boleto"),
  renewalType: z.enum(schema.renewalTypeValues).default("reajuste_operadora"),
  renewalContactPreference: z.string().trim().max(100).default("whatsapp"),
  postSaleNotes: z.string().trim().max(2000).optional(),
  approvedValue: z.coerce.number().finite().positive("Informe o valor aprovado da venda."),
  confirmationDocumentId: z.string().min(1, "Anexe a confirmação da operadora."),
  carrierId: z.string().uuid("Operadora inválida.").optional(),
});

const beneficiaryInput = z.object({
  leadId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de nascimento."),
  relationship: z.enum(schema.beneficiaryRelationshipValues),
  isHolder: z.boolean().default(false),
});

function addYears(value: string, years: number) {
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

async function assertLeadScope(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, corretorId: schema.leads.corretorId, planId: schema.leads.planId, nome: schema.leads.nome, telefone: schema.leads.telefone, email: schema.leads.email, status: schema.leads.status, qualificationDetails: schema.leads.qualificationDetails }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");
  if (context.role === "broker" && lead.corretorId !== context.userId) throw new Error("Você só pode operar seus próprios leads.");
  if (context.role === "manager" && lead.branchId !== context.branchId) throw new Error("Este lead não pertence à sua unidade.");
  return { context, db, lead };
}

export async function addLeadBeneficiaryAction(rawInput: z.input<typeof beneficiaryInput>) {
  const input = beneficiaryInput.parse(rawInput);
  const { context, db } = await assertLeadScope(input.leadId);

  const [holder] = await db.select({ id: schema.leadBeneficiaries.id }).from(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.leadId, input.leadId), eq(schema.leadBeneficiaries.tenantId, context.tenantId), eq(schema.leadBeneficiaries.isHolder, true))).limit(1);
  if (!holder && !input.isHolder) return { error: "O primeiro beneficiário precisa ser o titular." };

  if (input.isHolder) {
    await db.update(schema.leadBeneficiaries).set({ isHolder: false, updatedAt: new Date() }).where(and(eq(schema.leadBeneficiaries.leadId, input.leadId), eq(schema.leadBeneficiaries.tenantId, context.tenantId)));
  }

  const [created] = await db.insert(schema.leadBeneficiaries).values({
    id: randomUUID(), tenantId: context.tenantId, leadId: input.leadId, name: input.name,
    birthDate: input.birthDate, relationship: input.isHolder ? "titular" : input.relationship, isHolder: input.isHolder,
  }).returning({ id: schema.leadBeneficiaries.id });
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_beneficiary", entidadeId: created.id, acao: "criou" });
  return { success: true, id: created.id };
}

export async function removeLeadBeneficiaryAction(beneficiaryId: string) {
  if (!z.string().uuid().safeParse(beneficiaryId).success) return { error: "Beneficiário inválido." };
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [beneficiary] = await db.select({ id: schema.leadBeneficiaries.id, leadId: schema.leadBeneficiaries.leadId, isHolder: schema.leadBeneficiaries.isHolder }).from(schema.leadBeneficiaries).innerJoin(schema.leads, eq(schema.leadBeneficiaries.leadId, schema.leads.id)).where(and(eq(schema.leadBeneficiaries.id, beneficiaryId), eq(schema.leadBeneficiaries.tenantId, context.tenantId), context.role === "broker" ? eq(schema.leads.corretorId, context.userId) : context.role === "manager" ? eq(schema.leads.branchId, context.branchId ?? "") : undefined)).limit(1);
  if (!beneficiary) return { error: "Beneficiário não encontrado." };
  if (beneficiary.isHolder) return { error: "O titular não pode ser removido. Substitua-o antes." };
  const [quotedLineItem] = await db.select({ id: schema.quoteLineItems.id }).from(schema.quoteLineItems).where(and(eq(schema.quoteLineItems.tenantId, context.tenantId), eq(schema.quoteLineItems.beneficiaryId, beneficiary.id))).limit(1);
  if (quotedLineItem) return { error: "Este beneficiário já faz parte de uma cotação. Exclua ou substitua a cotação antes de removê-lo." };
  const [linkedDocument] = await db.select({ id: schema.leadDocuments.id }).from(schema.leadDocuments).where(and(eq(schema.leadDocuments.tenantId, context.tenantId), eq(schema.leadDocuments.beneficiaryId, beneficiary.id))).limit(1);
  if (linkedDocument) return { error: "Este beneficiário possui documentos vinculados. Remova ou substitua os documentos antes de excluí-lo." };
  try {
    await db.delete(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.id, beneficiary.id), eq(schema.leadBeneficiaries.tenantId, context.tenantId)));
  } catch {
    return { error: "Não foi possível excluir este beneficiário porque ele passou a ter vínculos operacionais. Atualize a página e tente novamente." };
  }
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead_beneficiary", entidadeId: beneficiary.id, acao: "removeu" });
  return { success: true };
}

/** Already converted, or an active sale exists: a second registration would duplicate client, commissions and reminders. */
class SaleAlreadyRegisteredError extends Error {}

type RegisterSaleResult = { success: true; saleId: string; activeCustomerId: string } | { success?: undefined; error: string };

/**
 * Registers the sale (04/11 review): every failure comes back as `{ error }` for the panel's toast, never as a
 * thrown error that would take the screen to the error page; the lead row is locked so a double click or two
 * tabs register one sale only.
 */
export async function registerSaleAction(rawInput: z.input<typeof registerSaleInput>): Promise<RegisterSaleResult> {
  const parsed = registerSaleInput.safeParse(rawInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados da venda." };
  try {
    return await registerSale(parsed.data);
  } catch (error) {
    if (error instanceof SaleAlreadyRegisteredError) return { error: error.message };
    console.error("[register-sale] failed", { leadId: parsed.data.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    const message = error instanceof Error ? error.message : "";
    // Scope and cargo messages are written for the user; anything else is generic.
    const forUser = /^(Lead não encontrado|Você só pode|Este lead não pertence|Seu cargo)/.test(message);
    return { error: forUser ? message : "Não foi possível registrar a venda. Tente de novo; se continuar, avise a direção." };
  }
}

async function registerSale(input: z.output<typeof registerSaleInput>): Promise<RegisterSaleResult> {
  const { context, db, lead } = await assertLeadScope(input.leadId);
  if (!hasPermission(context.role, "alterar_status_lead")) return { error: "Você não pode registrar vendas." };
  if (!lead.corretorId && context.role === "broker") return { error: "O lead precisa ter um corretor responsável." };
  // Convertido pela IA (venda detectada, 10/11) e ainda sem venda registrada: o corretor completa o registro.
  const completingAiSale = aiSaleRegistrationPending(lead.status, lead.qualificationDetails);
  if (lead.status === "converted" && !completingAiSale) return { error: "A venda deste lead já foi registrada." };
  if (lead.status === "lost") return { error: "Este lead está perdido. Reabra o lead antes de registrar a venda." };
  if (input.expirationDate && input.expirationDate <= input.coverageStartDate) return { error: "O vencimento precisa ser depois do início da vigência." };

  const beneficiaries = await db.select().from(schema.leadBeneficiaries).where(and(eq(schema.leadBeneficiaries.leadId, lead.id), eq(schema.leadBeneficiaries.tenantId, context.tenantId)));
  if (!beneficiaries.some((beneficiary) => beneficiary.isHolder)) return { error: "Cadastre o titular e os beneficiários antes de registrar a venda." };

  const [confirmation] = await db.select({ id: schema.leadDocuments.id, status: schema.leadDocuments.status }).from(schema.leadDocuments).where(and(eq(schema.leadDocuments.id, input.confirmationDocumentId), eq(schema.leadDocuments.leadId, lead.id), eq(schema.leadDocuments.tenantId, context.tenantId))).limit(1);
  if (!confirmation || confirmation.status !== "approved") return { error: "A confirmação da operadora precisa estar anexada e aprovada." };

  const requirements = await db.select({ id: schema.documentRequirements.id, required: schema.documentRequirements.required, appliesPerBeneficiary: schema.documentRequirements.appliesPerBeneficiary }).from(schema.documentRequirements).where(and(eq(schema.documentRequirements.tenantId, context.tenantId), or(isNull(schema.documentRequirements.planId), eq(schema.documentRequirements.planId, lead.planId ?? ""))));
  const documents = await db.select({ requirementId: schema.leadDocuments.requirementId, beneficiaryId: schema.leadDocuments.beneficiaryId, status: schema.leadDocuments.status }).from(schema.leadDocuments).where(and(eq(schema.leadDocuments.leadId, lead.id), eq(schema.leadDocuments.tenantId, context.tenantId)));
  const missing = requirements.filter((requirement) => requirement.required && (requirement.appliesPerBeneficiary ? beneficiaries.some((beneficiary) => !documents.some((document) => document.requirementId === requirement.id && document.beneficiaryId === beneficiary.id && document.status === "approved")) : !documents.some((document) => document.requirementId === requirement.id && document.status === "approved")));
  if (missing.length) return { error: "Ainda existem documentos obrigatórios pendentes ou rejeitados." };

  let resolvedPlanId = lead.planId;
  let carrierName: string | null = null;
  if (input.carrierId) {
    const [carrier] = await db
      .select({ id: schema.carriers.id, name: schema.carriers.name })
      .from(schema.carriers)
      .where(and(eq(schema.carriers.id, input.carrierId), eq(schema.carriers.tenantId, context.tenantId)))
      .limit(1);
    if (carrier) {
      carrierName = carrier.name;
      if (lead.planId) {
        const [plan] = await db
          .select({ id: schema.carrierPlans.id })
          .from(schema.carrierPlans)
          .where(and(eq(schema.carrierPlans.id, lead.planId), eq(schema.carrierPlans.carrierId, input.carrierId), eq(schema.carrierPlans.tenantId, context.tenantId)))
          .limit(1);
        if (!plan) resolvedPlanId = null;
      }
      // Without a plan on the lead none is guessed: an arbitrary "first plan" could pick the wrong commission rule.
    }
  }

  // Calculate lifecycle dates
  const expirationDate = input.expirationDate || addMonths(input.coverageStartDate, input.contractTermMonths);
  const renewalWindowStartDate = subtractDays(expirationDate, 90);

  const now = new Date();
  const saleId = randomUUID();
  const clientId = randomUUID();
  const activeCustomerId = randomUUID();
  const schedule = await generateCommissionSchedule(context.tenantId, saleId, resolvedPlanId, input.approvedValue);

  // Etapa de onde a venda saiu (desfecho do fechamento, 09/11).
  let soldFrom: { status: string; stageEnteredAt: Date | null } | null = null;
  await db.transaction(async (tx) => {
    // Lock the lead and check again inside the transaction: two concurrent submits register one sale.
    const [locked] = await tx.select({ status: schema.leads.status, stageEnteredAt: schema.leads.stageEnteredAt, qualificationDetails: schema.leads.qualificationDetails }).from(schema.leads)
      .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId))).limit(1).for("update");
    const lockedAiSale = Boolean(locked) && aiSaleRegistrationPending(locked!.status, locked!.qualificationDetails);
    if (!locked || (locked.status === "converted" && !lockedAiSale)) throw new SaleAlreadyRegisteredError("A venda deste lead já foi registrada.");
    if (locked.status === "lost") throw new SaleAlreadyRegisteredError("Este lead está perdido. Reabra o lead antes de registrar a venda.");
    // Já convertido pela IA: a etapa não muda de novo e o desfecho já foi avisado na conversão.
    soldFrom = lockedAiSale ? null : { status: locked.status, stageEnteredAt: locked.stageEnteredAt ?? null };
    const [activeSale] = await tx.select({ id: schema.sales.id }).from(schema.sales)
      .where(and(eq(schema.sales.leadId, lead.id), eq(schema.sales.tenantId, context.tenantId), eq(schema.sales.status, "active"))).limit(1);
    if (activeSale) throw new SaleAlreadyRegisteredError("Este lead já tem uma venda ativa registrada.");

    await tx.insert(schema.clients).values({ id: clientId, tenantId: context.tenantId, leadId: lead.id, branchId: lead.branchId, corretorId: lead.corretorId ?? context.userId, nome: lead.nome, telefone: lead.telefone, email: lead.email, convertedAt: now }).onConflictDoNothing({ target: schema.clients.leadId });
    const [client] = await tx.select({ id: schema.clients.id }).from(schema.clients).where(and(eq(schema.clients.leadId, lead.id), eq(schema.clients.tenantId, context.tenantId))).limit(1);

    await tx.insert(schema.sales).values({
      id: saleId,
      tenantId: context.tenantId,
      leadId: lead.id,
      clientId: client?.id ?? clientId,
      brokerId: lead.corretorId ?? context.userId,
      carrierPlanId: resolvedPlanId,
      saleDate: now,
      saleValue: input.approvedValue.toFixed(2),
      approvedValue: input.approvedValue.toFixed(2),
      policyNumber: input.policyNumber,
      coverageStartDate: input.coverageStartDate,
      contractTermMonths: input.contractTermMonths,
      expirationDate,
      renewalWindowStartDate,
      paymentMethod: input.paymentMethod,
      renewalType: input.renewalType,
      renewalContactPreference: input.renewalContactPreference,
      postSaleNotes: input.postSaleNotes ?? null,
      confirmationDocumentId: input.confirmationDocumentId,
      status: "active",
      createdBy: context.userId,
    });

    if (schedule.length) await tx.insert(schema.commissionSchedule).values(schedule);

    await tx.insert(schema.activeCustomers).values({
      id: activeCustomerId,
      tenantId: context.tenantId,
      saleId,
      clientId: client?.id ?? clientId,
      leadId: lead.id,
      brokerId: lead.corretorId ?? context.userId,
      branchId: lead.branchId,
      coverageStartDate: input.coverageStartDate,
      contractAnniversary: addYears(input.coverageStartDate, 1),
      contractTermMonths: input.contractTermMonths,
      expirationDate,
      renewalWindowStartDate,
      renewalStatus: "pending_window",
      renewalNotes: input.postSaleNotes ?? null,
    });

    // Schedule renewal reminders (T-90, T-60, T-30, T-15)
    const reminderTriggers = [
      { type: "t_90", days: 90 },
      { type: "t_60", days: 60 },
      { type: "t_30", days: 30 },
      { type: "t_15", days: 15 },
    ];

    for (const trigger of reminderTriggers) {
      const scheduledFor = subtractDays(expirationDate, trigger.days);
      await tx.insert(schema.customerRenewalReminders).values({
        id: randomUUID(),
        tenantId: context.tenantId,
        activeCustomerId,
        saleId,
        clientId: client?.id ?? clientId,
        brokerId: lead.corretorId ?? context.userId,
        triggerType: trigger.type,
        scheduledFor,
        status: "pending",
      });
    }

    if (lockedAiSale) {
      // Registro concluído: o card "Complete o registro da venda" some.
      const details = (locked.qualificationDetails as Record<string, unknown> | null) ?? {};
      const marker = (details.aiSaleDetected as Record<string, unknown> | undefined) ?? {};
      await tx.update(schema.leads).set({
        qualificationDetails: { ...details, aiSaleDetected: { ...marker, registrationPending: false, registeredAt: now.toISOString(), registeredBy: context.userId } },
        updatedAt: now,
        version: sql`${schema.leads.version} + 1`,
      }).where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
    } else {
      await tx.update(schema.leads).set({ status: "converted", stageEnteredAt: now, updatedAt: now, version: sql`${schema.leads.version} + 1` }).where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));
      // Histórico de etapas (05/11): a venda registrada fecha o funil do lead.
      await recordStageChangeForLead(tx, { tenantId: context.tenantId, leadId: lead.id, fromStatus: locked.status, toStatus: "converted", changedAt: now, actorType: stageActorType({ role: context.role }), actorUserId: context.userId, reason: "Venda registrada", previousStageEnteredAt: locked.stageEnteredAt ?? null });
    }
    const metadata: Record<string, unknown> = {
      saleId,
      policyNumber: input.policyNumber,
      expirationDate,
      renewalType: input.renewalType,
    };
    if (carrierName) {
      metadata.carrierId = input.carrierId;
      metadata.carrierName = carrierName;
    }
    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId: lead.id,
      userId: context.userId,
      tipo: "status_change",
      conteudo: carrierName
        ? `Venda registrada com ${carrierName}. Contrato de ${input.contractTermMonths} meses com vencimento em ${expirationDate}.`
        : `Venda registrada. Contrato de ${input.contractTermMonths} meses com vencimento em ${expirationDate}.`,
      metadata,
    });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "sale", entidadeId: saleId, acao: "registrou" });
    // With a broker the push below already writes the inbox row; one notice, not two.
    if (!lead.corretorId) await tx.insert(schema.notifications).values({ id: randomUUID(), tenantId: context.tenantId, recipientUserId: context.userId, leadId: lead.id, type: "sale_registered", title: "Venda registrada", message: `${lead.nome} foi convertido em cliente ativo. Vencimento: ${expirationDate}.`, createdAt: now });
  });

  // Desfecho do fechamento (09/11): a venda de um lead em Documentação ou Em análise avisa a direção.
  const closedFrom = soldFrom as { status: string; stageEnteredAt: Date | null } | null;
  if (closedFrom) {
    const { notifyDirectorsClosingOutcome } = await import("@/features/leads/closing-outcome-notice");
    void notifyDirectorsClosingOutcome({
      tenantId: context.tenantId,
      leadId: lead.id,
      previousStatus: closedFrom.status,
      newStatus: "converted",
      actorType: stageActorType({ role: context.role }),
      actorUserId: context.userId,
      changedAt: now,
      previousStageEnteredAt: closedFrom.stageEnteredAt,
      saleValue: input.approvedValue,
    });
    // Venda fechada para a direção (11/11). A venda que a IA já converteu (lockedAiSale) avisou na conversão.
    const { notifyDirectorsLeadConverted } = await import("@/features/leads/lead-converted-director-alert");
    void notifyDirectorsLeadConverted({
      tenantId: context.tenantId,
      leadId: lead.id,
      previousStatus: closedFrom.status,
      newStatus: "converted",
      previousStageEnteredAt: closedFrom.stageEnteredAt,
      convertedAt: now,
      origin: { kind: "person", actorUserId: context.userId },
    });
  }

  // Only after the commit: a rolled-back sale never fires the "venda realizada" automation.
  const { triggerInstantAutomation } = await import("@/features/automations/engine");
  void triggerInstantAutomation(context.tenantId, lead.id, "venda_realizada").catch(console.error);

  // Lists and kanban of the direction, the unit manager and the broker update without F5 (best effort).
  void (async () => {
    const watcherScope = lead.branchId
      ? or(eq(schema.tenantMemberships.role, "director"), and(eq(schema.tenantMemberships.role, "manager"), eq(schema.tenantMemberships.branchId, lead.branchId)))
      : eq(schema.tenantMemberships.role, "director");
    const watchers = await db.select({ userId: schema.tenantMemberships.userId }).from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.status, "active"), watcherScope))
      .groupBy(schema.tenantMemberships.userId).limit(20);
    const targets = new Set(watchers.map((watcher) => watcher.userId));
    if (lead.corretorId) targets.add(lead.corretorId);
    targets.delete(context.userId);
    await publishDomainInvalidation([...targets].map((userId) => ({ tenantId: context.tenantId, userId })), "leads");
  })().catch(() => { /* non-blocking */ });

  // Conversions API for CRM: "Venda" (Lead Ads leads only, never throws).
  await enqueueMetaConversionEvent({ tenantId: context.tenantId, leadId: lead.id, stage: "sale", at: now });

  // Notify via push (outside transaction — non-blocking)
  if (lead.corretorId) {

    void publishNotification({
      capability: "lead_converted",
      tenantId: context.tenantId,
      recipientUserId: lead.corretorId,
      leadId: lead.id,
      type: "lead_converted",
      title: "Venda registrada com sucesso!",
      message: `${lead.nome} foi convertido em cliente ativo. Confira os detalhes.`,
      pushTitle: "Venda Registrada! 🎉",
      pushBody: `${lead.nome} foi convertido. Verifique a comissão.`,
      url: `/leads/${lead.id}`,
      tag: `sale-${saleId}`,
    }).catch(() => { /* non-blocking */ });
  }
  return { success: true, saleId, activeCustomerId };
}

export async function cancelActiveCustomerAction(rawInput: { activeCustomerId: string; cancellationDate: string; reason: string }) {
  const input = z.object({ activeCustomerId: z.string().min(1), cancellationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().trim().min(3).max(500) }).parse(rawInput);
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  if (context.role === "broker") return { error: "Apenas gestores e diretores podem registrar cancelamentos." };
  const [customer] = await db.select({ id: schema.activeCustomers.id, saleId: schema.activeCustomers.saleId, leadId: schema.activeCustomers.leadId, branchId: schema.activeCustomers.branchId, status: schema.activeCustomers.status }).from(schema.activeCustomers).where(and(eq(schema.activeCustomers.id, input.activeCustomerId), eq(schema.activeCustomers.tenantId, context.tenantId), context.role === "manager" ? eq(schema.activeCustomers.branchId, context.branchId ?? "") : undefined)).limit(1);
  if (!customer) return { error: "Cliente ativo não encontrado no seu escopo." };
  if (customer.status === "cancelled") return { error: "Este cliente já está cancelado." };
  const [settings] = await db.select({ days: schema.postSaleSettings.chargebackWindowDays }).from(schema.postSaleSettings).where(and(eq(schema.postSaleSettings.tenantId, context.tenantId), eq(schema.postSaleSettings.active, true))).limit(1);
  const windowDays = settings?.days ?? 90;
  const cutoff = new Date(`${input.cancellationDate}T00:00:00Z`); cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  await db.transaction(async (tx) => {
    await tx.update(schema.activeCustomers).set({ status: "cancelled", cancellationDate: input.cancellationDate, cancellationReason: input.reason, updatedAt: new Date() }).where(eq(schema.activeCustomers.id, customer.id));
    await tx.update(schema.commissionSchedule).set({ status: "cancelled", notes: "Cancelado antes do pagamento." }).where(and(eq(schema.commissionSchedule.saleId, customer.saleId), eq(schema.commissionSchedule.status, "pending")));
    await tx.update(schema.commissionSchedule).set({ status: "chargeback_pending", notes: `Revisar chargeback dentro da janela configurada de ${windowDays} dias.` }).where(and(eq(schema.commissionSchedule.saleId, customer.saleId), eq(schema.commissionSchedule.status, "paid"), gte(schema.commissionSchedule.paidAt, cutoff), lt(schema.commissionSchedule.paidAt, new Date(`${input.cancellationDate}T23:59:59Z`))));
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "active_customer", entidadeId: customer.id, acao: "cancelou" });
    await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: customer.leadId, userId: context.userId, tipo: "system_alert", conteudo: `Cliente ativo cancelado. Motivo: ${input.reason}` });
  });
  return { success: true, chargebackWindowDays: windowDays };
}

export async function updatePostSaleSettingsAction(rawInput: { chargebackWindowDays: number; active: boolean }) {
  const input = z.object({ chargebackWindowDays: z.number().int().min(0).max(3650), active: z.boolean() }).parse(rawInput);
  const context = await getRequiredTenantContext();
  if (context.role !== "director") return { error: "Apenas o diretor pode alterar esta configuração." };
  const db = getDatabase();
  const [existing] = await db.select({ id: schema.postSaleSettings.id }).from(schema.postSaleSettings).where(eq(schema.postSaleSettings.tenantId, context.tenantId)).limit(1);
  if (existing) await db.update(schema.postSaleSettings).set({ chargebackWindowDays: input.chargebackWindowDays, active: input.active, updatedBy: context.userId, updatedAt: new Date() }).where(eq(schema.postSaleSettings.id, existing.id));
  else await db.insert(schema.postSaleSettings).values({ id: randomUUID(), tenantId: context.tenantId, chargebackWindowDays: input.chargebackWindowDays, active: input.active, updatedBy: context.userId });
  await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "post_sale_settings", entidadeId: existing?.id ?? context.tenantId, acao: "alterou" });
  return { success: true };
}

export async function updateCustomerRenewalStatusAction(rawInput: {
  activeCustomerId: string;
  renewalStatus: "pending_window" | "in_renewal" | "renewed" | "churned";
  renewalNotes?: string;
}) {
  const input = z
    .object({
      activeCustomerId: z.string().min(1),
      renewalStatus: z.enum(schema.customerRenewalStatusValues),
      renewalNotes: z.string().trim().max(1000).optional(),
    })
    .parse(rawInput);

  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const customerScope = buildCustomerRenewalStatusScope(context);

  const [customer] = await db
    .select({
      id: schema.activeCustomers.id,
      clientId: schema.activeCustomers.clientId,
      leadId: schema.activeCustomers.leadId,
      brokerId: schema.activeCustomers.brokerId,
      branchId: schema.activeCustomers.branchId,
      status: schema.activeCustomers.status,
    })
    .from(schema.activeCustomers)
    .where(
      and(
        eq(schema.activeCustomers.id, input.activeCustomerId),
        eq(schema.activeCustomers.tenantId, context.tenantId),
        customerScope,
      ),
    )
    .limit(1);

  if (!customer) return { error: "Cliente não encontrado ou fora do seu escopo." };

  if (!hasPermission(context.role, "alterar_status_lead")) return { error: "Você não pode atualizar a renovação." };
  if (customer.status === "cancelled") return { error: "Não é possível atualizar a renovação de um cliente cancelado." };

  const now = new Date();
  const [updated] = await db
    .update(schema.activeCustomers)
    .set({
      renewalStatus: input.renewalStatus,
      lastRenewalAttemptAt: now,
      renewalNotes: input.renewalNotes ?? null,
      updatedAt: now,
    })
    .where(and(eq(schema.activeCustomers.id, customer.id), customerScope))
    .returning({ id: schema.activeCustomers.id });

  if (!updated) return { error: "Cliente não encontrado ou fora do seu escopo." };

  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId: context.userId,
    entidade: "active_customer",
    entidadeId: customer.id,
    acao: "alterou_status_renovacao",
  });

  return { success: true };
}
