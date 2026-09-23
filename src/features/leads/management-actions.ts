"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";

import { notifyLeadReassigned } from "@/features/notifications/send-push-helper";
import { publishLeadInvalidation } from "@/features/leads/publish-lead-invalidation";
import { enqueueLeadEffectTx, runLeadEffectOutboxProcessor } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { checkBrokerScheduleAvailability } from "@/features/leads/assignment";
import { withServerActionTiming } from "@/shared/observability/request-timing";
import { canRemoveLeadAssignment, getLeadAssignmentBlockedReason } from "./assignment-domain";
import { getActiveQueueDutyRoster } from "@/features/lead-distribution/active-queue-duty-roster";
import { canManuallyAssignLeadToBroker } from "@/features/lead-distribution/duty-roster-matching";
import { offerLeadToBrokerManually } from "@/features/lead-distribution/service";
import { enqueueAndProcessLeadDistribution, enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { getSystemSetting } from "@/features/system-settings/queries";

const inputSchema = z.object({ leadId: z.string().uuid(), brokerId: z.string().uuid().nullable(), assignmentMode: z.enum(["direct", "offer"]).optional() });

export type ManagementActionState = {
  success?: boolean;
  error?: string;
  warning?: string;
  message?: string;
  mutationId?: string;
  entity?: {
    leadId: string;
    branchId: string | null;
    corretorId: string | null;
    status: string;
    distributionStatus?: string;
  };
};

import { AuthorizationService } from "@/shared/auth/authorization-service";
import { buildLeadResourceScope, toEffectiveLeadAccessContext } from "@/features/leads/lead-authorization";
import { evaluateShadowAuthorization } from "@/shared/auth/shadow-mode";

async function getManagedLead(leadId: string) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const [lead] = await db.select({ id: schema.leads.id, nome: schema.leads.nome, tenantId: schema.leads.tenantId, branchId: schema.leads.branchId, status: schema.leads.status, corretorId: schema.leads.corretorId, distributionStatus: schema.leads.distributionStatus, firstContactAt: schema.leads.firstContactAt, serviceStartedAt: schema.leads.serviceStartedAt, archivedAt: schema.leads.archivedAt, deletedAt: schema.leads.deletedAt, queueId: schema.leads.queueId, webhookCredentialId: schema.leads.webhookCredentialId })
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

export async function getLeadDutyReassignmentOptions(leadId: string) {
  try {
    const parsedLeadId = z.string().uuid().parse(leadId);
    const { context, lead } = await getManagedLead(parsedLeadId);
    const roster = await getActiveQueueDutyRoster({
      tenantId: context.tenantId,
      queueId: lead.queueId,
      webhookCredentialId: lead.webhookCredentialId,
    });
    return { success: true as const, leadId: parsedLeadId, ...roster };
  } catch (error) {
    return {
      success: false as const,
      leadId,
      error: error instanceof AuthorizationError
        ? error.message
        : "Não foi possível consultar o plantão desta fila.",
    };
  }
}

export async function removeLeadAssignmentAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  return withServerActionTiming("/leads", "leads.remove_assignment", async () => {
    const mutationId = randomUUID();
    try {
      const leadId = z.string().uuid().parse(formData.get("leadId"));
      const { context, db, lead } = await getManagedLead(leadId);
      if (!canRemoveLeadAssignment(lead)) {
        throw new Error(getLeadAssignmentBlockedReason(lead) ?? "A atribuição deste lead não pode ser removida neste estado.");
      }

      const now = new Date();
      const currentBrokerId = lead.corretorId!;
      const changed = await db.transaction(async (tx) => {
        // Recheck ownership and service-start markers atomically. If the broker
        // starts a conversation at the same time, only one of the two writes wins.
        const updated = await tx.update(schema.leads).set({
          corretorId: null,
          distributionStatus: "manual_hold",
          assignmentSource: "manual_unassignment",
          distributionUpdatedAt: now,
          updatedAt: now,
        }).where(and(
          eq(schema.leads.id, lead.id),
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.corretorId, currentBrokerId),
          eq(schema.leads.distributionStatus, "assigned"),
          inArray(schema.leads.status, ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]),
          isNull(schema.leads.archivedAt),
          isNull(schema.leads.deletedAt),
        )).returning({ id: schema.leads.id });
        if (!updated.length) return false;

        const activeOffers = await tx.select({ outboundMessageId: schema.leadOffers.outboundMessageId })
          .from(schema.leadOffers)
          .where(and(
            eq(schema.leadOffers.tenantId, context.tenantId),
            eq(schema.leadOffers.leadId, lead.id),
            eq(schema.leadOffers.brokerId, currentBrokerId),
            inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
          ));
        const outboundIds = activeOffers.map((offer) => offer.outboundMessageId).filter((id): id is string => Boolean(id));
        await tx.update(schema.leadOffers).set({ status: "CANCELLED", updatedAt: now }).where(and(
          eq(schema.leadOffers.tenantId, context.tenantId),
          eq(schema.leadOffers.leadId, lead.id),
          eq(schema.leadOffers.brokerId, currentBrokerId),
          inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]),
        ));
        if (outboundIds.length) {
          await tx.update(schema.whatsappOutboundMessages).set({
            status: "cancelled",
            providerErrorCode: "LEAD_ASSIGNMENT_REMOVED",
            providerErrorMessage: "Oferta cancelada porque a atribuição do lead foi removida.",
            failedAt: now,
            updatedAt: now,
          }).where(and(
            eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
            inArray(schema.whatsappOutboundMessages.id, outboundIds),
            inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
          ));
        }
        await tx.update(schema.leadAssignmentAttempts).set({
          status: "released",
          releasedAt: now,
          releaseReason: "Atribuição removida manualmente; o histórico do atendimento foi preservado.",
        }).where(and(
          eq(schema.leadAssignmentAttempts.tenantId, context.tenantId),
          eq(schema.leadAssignmentAttempts.leadId, lead.id),
          eq(schema.leadAssignmentAttempts.brokerId, currentBrokerId),
          eq(schema.leadAssignmentAttempts.status, "open"),
        ));
        await tx.update(schema.leadDistributionJobs).set({
          status: "superseded",
          completedAt: now,
          lockedAt: null,
          lockedBy: null,
          leaseExpiresAt: null,
          lastErrorCode: "MANUAL_ASSIGNMENT_REMOVAL",
          lastErrorMessage: "Lead aguarda uma nova ação manual de distribuição.",
          updatedAt: now,
        }).where(and(
          eq(schema.leadDistributionJobs.tenantId, context.tenantId),
          eq(schema.leadDistributionJobs.leadId, lead.id),
          inArray(schema.leadDistributionJobs.status, ["pending", "retrying"]),
        ));
        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: context.tenantId,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: lead.branchId,
          fromQueueId: lead.queueId,
          toQueueId: lead.queueId,
          previousOwnerId: currentBrokerId,
          newOwnerId: null,
          action: "assignment_removed",
          source: context.role === "director" ? "manual_director" : "manual_manager",
          strategy: "manual",
          reason: "Atribuição removida por gestor; etapa e histórico preservados, aguardará ação manual.",
          actorId: context.userId,
          createdAt: now,
        });
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "lead_distribution",
          entidadeId: lead.id,
          acao: "lead.assignment_removed",
          createdAt: now,
        });
        return true;
      });

      if (!changed) throw new Error("O estado do lead mudou. Atualize a página antes de tentar novamente.");
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: [lead.branchId],
        brokerIds: [currentBrokerId],
      }).catch(() => undefined);
      return {
        success: true,
        mutationId,
        entity: { leadId: lead.id, branchId: lead.branchId, corretorId: null, status: lead.status, distributionStatus: "manual_hold" },
      };
    } catch (error) {
      return { mutationId, error: error instanceof Error ? error.message : "Não foi possível remover a atribuição." };
    }
  });
}

export async function reassignLeadAction(_prev: ManagementActionState, formData: FormData): Promise<ManagementActionState> {
  return withServerActionTiming("/leads", "leads.reassign", async () => {
    const mutationId = randomUUID();
    try {
      const input = inputSchema.parse({ leadId: formData.get("leadId"), brokerId: String(formData.get("brokerId") || "") || null, assignmentMode: formData.get("assignmentMode") || undefined });
      const { context, db, lead } = await getManagedLead(input.leadId);
      if (["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(lead.status)) throw new Error("Este lead já está em atendimento. Finalize ou libere o atendimento atual antes de reatribuir.");
      if (!input.brokerId) throw new Error("Selecione um corretor para reatribuir o lead.");
      const assignmentChoiceEnabled = (await getSystemSetting("feature_manual_lead_assignment_offer_choice_enabled")) !== "false";
      if (!lead.corretorId && assignmentChoiceEnabled && !input.assignmentMode) throw new Error("Escolha se deseja atribuir direto ou enviar uma oferta para aceite.");
      if (input.assignmentMode && (!assignmentChoiceEnabled || lead.corretorId)) throw new Error("Esta escolha está disponível somente para leads sem corretor e quando habilitada pelo Super-admin.");
      const brokerId = input.brokerId;
      const assignmentEventId = randomUUID();
      const dutyRoster = await getActiveQueueDutyRoster({
        tenantId: context.tenantId,
        queueId: lead.queueId,
        webhookCredentialId: lead.webhookCredentialId,
      });
      const [broker] = await db.select({ id: schema.user.id, branchId: schema.tenantMemberships.branchId }).from(schema.tenantMemberships)
        .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
        .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), eq(schema.tenantMemberships.userId, input.brokerId), eq(schema.tenantMemberships.role, "broker"), eq(schema.tenantMemberships.status, "active"), eq(schema.user.active, true), eq(schema.user.status, "active"))).limit(1);
      if (!broker) throw new Error("O corretor selecionado não está ativo neste tenant.");
      if (!canManuallyAssignLeadToBroker({
        hasActiveQueueDuty: dutyRoster.hasActiveDuty,
        brokerId: broker.id,
        brokerBranchId: broker.branchId,
        leadBranchId: lead.branchId,
        activeDutyBrokerIds: dutyRoster.brokers.map((candidate) => candidate.id),
      })) {
        throw new Error(dutyRoster.hasActiveDuty
          ? "O corretor selecionado não está escalado no plantão ativo desta fila."
          : "O corretor selecionado não pertence à filial deste lead.");
      }
      if (input.assignmentMode === "offer") {
        const offered = await offerLeadToBrokerManually(context, lead.id, brokerId);
        if (offered.status === "conflict") throw new Error(offered.reason);
        if (offered.status === "fallback") {
          await enqueueAndProcessLeadDistribution({ tenantId: context.tenantId, leadId: lead.id, source: "manual_offer_delivery_failed" });
          return { success: true, message: offered.reason, mutationId, entity: { leadId: lead.id, branchId: lead.branchId, corretorId: null, status: lead.status, distributionStatus: "queued" } };
        }
        await enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: lead.id, runAfter: offered.expiresAt });
        void publishLeadInvalidation({ tenantId: context.tenantId, actorId: context.userId, branchIds: [lead.branchId, broker.branchId].filter((id): id is string => Boolean(id)), brokerIds: [brokerId] }).catch(() => undefined);
        return { success: true, message: "Oferta enviada ao corretor. Se não houver aceite no prazo configurado, o lead volta à distribuição normal.", mutationId, entity: { leadId: lead.id, branchId: lead.branchId, corretorId: brokerId, status: "distributed", distributionStatus: "assigned" } };
      }
      const now = new Date();
      const [tenantPolicy] = await db.select({ feedbackRequiredEnabled: schema.tenants.feedbackRequiredEnabled, feedbackGraceMinutes: schema.tenants.feedbackGraceMinutes, slaFirstContactMinutes: schema.tenants.slaFirstContactMinutes }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1);

      const availabilityCheck = dutyRoster.hasActiveDuty
        ? { isConfigured: false, isWithinSchedule: true }
        : await checkBrokerScheduleAvailability(context.tenantId, brokerId);
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
          reason: dutyRoster.hasActiveDuty
            ? "Reatribuição manual para corretor escalado no plantão ativo da fila."
            : "Reatribuição manual",
          metadata: {
            assignmentScope: dutyRoster.hasActiveDuty ? "active_queue_duty" : "lead_branch",
            assignedBrokerBranchId: broker.branchId,
          },
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
            ...(input.assignmentMode === "direct" ? { skipBrokerWhatsapp: "true" } : {}),
          },
        });
      });
      if (lead.corretorId && lead.corretorId !== brokerId) {
        void notifyLeadReassigned(lead.id, lead.tenantId, lead.corretorId, lead.nome).catch(console.error);
      }
      void publishLeadInvalidation({
        tenantId: context.tenantId,
        actorId: context.userId,
        branchIds: Array.from(new Set([lead.branchId, broker.branchId].filter((branchId): branchId is string => Boolean(branchId)))),
        brokerIds: [lead.corretorId, input.brokerId],
      }).catch(() => undefined);
      scheduleAfterResponse("lead-assignment-effects", async () => {
        await runLeadEffectOutboxProcessor({
          tenantId: context.tenantId,
          leadId: lead.id,
          limit: 5,
        });
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
      await tx.update(schema.leads).set({ corretorId: context.userId, status: "under_analysis", distributionStatus: "assigned", assignedAt: now, stageEnteredAt: now, firstContactAt: null, serviceStartedAt: null, serviceStartedBy: null }).where(eq(schema.leads.id, lead.id));
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
      const result = await tx.update(schema.leads).set({ corretorId: context.userId, distributionStatus: "assigned", assignedAt: now, stageEnteredAt: now, serviceStartedBy: context.userId })
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
