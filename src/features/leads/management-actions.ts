"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";

import { notifyLeadReassigned } from "@/features/notifications/send-push-helper";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { enqueueLeadEffectTx, runLeadEffectOutboxProcessor } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { checkBrokerScheduleAvailability } from "@/features/leads/assignment";
import { withServerActionTiming } from "@/shared/observability/request-timing";

const inputSchema = z.object({ leadId: z.string().uuid(), brokerId: z.string().uuid().nullable() });

export type ManagementActionState = {
  success?: boolean;
  error?: string;
  warning?: string;
  mutationId?: string;
  entity?: {
    leadId: string;
    branchId: string | null;
    corretorId: string | null;
    status: string;
  };
};

import { AuthorizationService } from "@/shared/auth/authorization-service";
import { buildLeadResourceScope, toEffectiveLeadAccessContext } from "@/features/leads/lead-authorization";
import { evaluateShadowAuthorization } from "@/shared/auth/shadow-mode";

async function getManagedLead(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, status: schema.leads.status, corretorId: schema.leads.corretorId })
    .from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead) throw new Error("Lead não encontrado.");

  const resourceScope = buildLeadResourceScope(lead);
  const accessContext = toEffectiveLeadAccessContext(context);
  const legacyAllowed =
    context.role === "director" ||
    (context.role === "manager" && Boolean(context.branchId) && context.branchId === lead.branchId);

  await evaluateShadowAuthorization({
    operationKey: "lead.reassign",
    legacyAllowed,
    context: accessContext,
    capability: "leads_reassign",
    resource: resourceScope,
  });

  const isDirector = context.role === "director" || accessContext.canAccessAllUnits;
  const isAllowed = isDirector || AuthorizationService.can(accessContext, "leads_reassign", resourceScope) || (context.role === "manager" && accessContext.allowedUnitIds.includes(lead.branchId ?? ""));
  if (!isAllowed) {
    throw new AuthorizationError("Este lead está fora da sua filial ou escopo autorizado.");
  }

  return { context, db, lead };
}

export async function reassignLeadAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  return withServerActionTiming("/leads", "leads.reassign", async () => {
    const mutationId = randomUUID();
    try {
      const input = inputSchema.parse({ leadId: formData.get("leadId"), brokerId: String(formData.get("brokerId") || "") || null });
      const { context, db, lead } = await getManagedLead(input.leadId);
      if (["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) throw new Error("Este lead já está em atendimento. Finalize ou libere o atendimento atual antes de reatribuir.");
      if (!input.brokerId) throw new Error("Selecione um corretor para reatribuir o lead.");
      const brokerId = input.brokerId;
      const assignmentEventId = randomUUID();
      const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true))).limit(1);
      if (!broker || broker.branchId !== lead.branchId) throw new Error("O corretor selecionado não pertence à filial deste lead.");
      const now = new Date();
      const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);

      const availabilityCheck = await checkBrokerScheduleAvailability(context.tenantId, brokerId);
      let warning: string | undefined = undefined;
      if (availabilityCheck.isConfigured && !availabilityCheck.isWithinSchedule) {
        warning = "Aviso: O corretor está fora da agenda de atendimento configurada, mas a atribuição manual foi realizada com sucesso.";
      }

      await db.transaction(async (tx) => {
        await tx.update(schema.leads).set({
          corretorId: input.brokerId,
          status: "distributed",
          distributionStatus: "assigned",
          assignmentSource: context.role === "director" ? "manual_director" : "manual_manager",
          assignmentStrategy: "manual",
          distributionUpdatedAt: now,
          assignedAt: now,
          firstContactAt: null,
          serviceStartedAt: null,
          serviceStartedBy: null,
          stageEnteredAt: now,
          motivoPerda: null,
        }).where(eq(schema.leads.id, lead.id));
        if (tenantPolicy?.feedbackRequiredEnabled !== false) await tx.insert(schema.leadAssignmentAttempts).values({ id: randomUUID(), tenantId: lead.tenantId, leadId: lead.id, brokerId, sequence: 1, assignedAt: now, feedbackDueAt: new Date(now.getTime() + ((Number.parseInt(tenantPolicy?.slaFirstContactMinutes ?? "15", 10) || 15) + (Number.parseInt(tenantPolicy?.feedbackGraceMinutes ?? "5", 10) || 5)) * 60_000), status: "open", createdAt: now });
        await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `Lead reatribuído por ${context.role === "director" ? "Diretor" : "Gestor"}; SLA reiniciado.` });
        await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "reatribuiu_lead" });
        await tx.insert(schema.leadDistributionEvents).values({
          id: assignmentEventId,
          tenantId: lead.tenantId,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: lead.branchId,
          previousOwnerId: lead.corretorId,
          newOwnerId: brokerId,
          action: "assigned",
          source: context.role === "director" ? "manual_director" : "manual_manager",
          strategy: "manual",
          reason: "Reatribuição manual",
          actorId: context.userId,
          createdAt: now,
        });
        await enqueueLeadEffectTx(tx, {
          tenantId: lead.tenantId,
          leadId: lead.id,
          type: "NOTIFY_LEAD_ASSIGNED",
          idempotencyKey: `lead-assigned:${assignmentEventId}`,
          payload: {
            branchId: lead.branchId,
            brokerId,
            leadName: lead.nome,
            isRedistribution: lead.corretorId ? "true" : "false",
          },
        });
      });
      if (lead.corretorId && lead.corretorId !== brokerId) {
        void notifyLeadReassigned(lead.id, lead.tenantId, lead.corretorId, lead.nome).catch(console.error);
      }
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: [lead.branchId],
        brokerIds: [lead.corretorId, input.brokerId],
      }).catch(() => undefined);
      scheduleAfterResponse("lead-assignment-effects", async () => {
        await runLeadEffectOutboxProcessor({
          tenantId: context.tenantId,
          leadId: lead.id,
          limit: 5,
        });
        await processMetaOutboundBatch(10, context.tenantId);
      });
      return {
        success: true,
        warning,
        mutationId,
        entity: { leadId: lead.id, branchId: lead.branchId, corretorId: input.brokerId, status: "distributed" },
      };
    } catch (error) {
      return { mutationId, error: error instanceof Error ? error.message : "Não foi possível reatribuir o lead." };
    }
  });
}

export async function assumeLeadForInvestigationAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  const mutationId = randomUUID();
  try {
    const leadId = z.string().uuid().parse(formData.get("leadId"));
    const reason = z.string().trim().min(3).max(200).parse(formData.get("reason"));
    const { context, db, lead } = await getManagedLead(leadId);
    if (["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) throw new Error("Este lead já está ativo em atendimento e não pode ser assumido por outro usuário.");
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(schema.leads).set({ corretorId: context.userId, status: "under_analysis", assignedAt: now, stageEnteredAt: now, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null }).where(eq(schema.leads.id, lead.id));
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `Lead assumido para investigação por ${context.role === "director" ? "Diretor" : "Gestor"}. Motivo: ${reason}` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_lead_investigacao" });
    });
    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [lead.branchId],
      brokerIds: [lead.corretorId, context.userId],
    }).catch(() => undefined);
    return {
      success: true,
      mutationId,
      entity: { leadId: lead.id, branchId: lead.branchId, corretorId: context.userId, status: "under_analysis" },
    };
  } catch (error) {
    return { mutationId, error: error instanceof Error ? error.message : "Não foi possível assumir o lead para investigação." };
  }
}

export async function assumeLeadForMessagingAction(leadId: string): Promise<ManagementActionState> {
  const mutationId = randomUUID();
  try {
    const { context, db, lead } = await getManagedLead(z.string().uuid().parse(leadId));
    if (lead.corretorId === context.userId) {
      return {
        success: true,
        mutationId,
        entity: { leadId: lead.id, branchId: lead.branchId, corretorId: context.userId, status: lead.status },
      };
    }
    if (!lead.corretorId) throw new Error("Este lead ainda não possui um corretor responsável.");
    const currentOwnerId = lead.corretorId;
    if (!["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) {
      throw new Error("O atendimento só pode ser assumido quando já estiver ativo.");
    }
    const now = new Date();
    const updated = await db.transaction(async (tx) => {
      const result = await tx.update(schema.leads).set({ corretorId: context.userId, assignedAt: now, stageEnteredAt: now, serviceStartedBy: context.userId })
        .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, currentOwnerId)))
        .returning({ id: schema.leads.id });
      if (!result.length) return false;
      await tx.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: lead.id, userId: context.userId, tipo: "system_alert", conteudo: `${context.role === "director" ? "Diretor" : "Gestor"} assumiu o atendimento para continuidade da conversa.` });
      await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: lead.id, acao: "assumiu_atendimento" });
      return true;
    });
    if (!updated) throw new Error("Este atendimento foi assumido por outra pessoa. Atualize a página.");
    void publishLeadInvalidation({
      tenantId: context.tenantId,
      actorId: context.userId,
      branchIds: [lead.branchId],
      brokerIds: [currentOwnerId, context.userId],
    }).catch(() => undefined);
    return {
      success: true,
      mutationId,
      entity: { leadId: lead.id, branchId: lead.branchId, corretorId: context.userId, status: lead.status },
    };
  } catch (error) {
    return { mutationId, error: error instanceof Error ? error.message : "Não foi possível assumir o atendimento." };
  }
}
