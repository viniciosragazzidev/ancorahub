import "server-only";

import { and, eq, inArray, isNotNull, lt, notInArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { enqueueAndProcessLeadDistribution } from "@/features/lead-distribution/jobs";
import { transitionConversationState } from "./conversation-state-machine";
import { resolveQualificationTimeoutRoute } from "./qualification-timeout-routing";

export interface QualificationTimeoutSweepResult {
  tenantsChecked: number;
  timedOutLeads: number;
  distributedLeads: number;
}

export async function runQualificationTimeoutSweep(tenantIdFilter?: string): Promise<QualificationTimeoutSweepResult> {
  let db;
  try {
    db = getDatabase();
  } catch {
    return { tenantsChecked: 0, timedOutLeads: 0, distributedLeads: 0 };
  }
  const now = Date.now();

  // Buscar os tenants ativos e suas configurações de qualificação
  const tenants = await db
    .select({
      id: schema.tenants.id,
    })
    .from(schema.tenants)
    .where(tenantIdFilter ? eq(schema.tenants.id, tenantIdFilter) : eq(schema.tenants.status, "active"));

  let timedOutLeadsCount = 0;
  let distributedLeadsCount = 0;

  for (const tenant of tenants) {
    // Buscar timeout configurado para o tenant (padrão: 20 minutos)
    const [config] = await db
      .select({
        timeoutMinutes: schema.aiQualificationConfigs.timeoutMinutes,
      })
      .from(schema.aiQualificationConfigs)
      .where(eq(schema.aiQualificationConfigs.tenantId, tenant.id))
      .limit(1);

    const timeoutMinutes = Math.max(5, config?.timeoutMinutes ?? 30); // Default 30 minutos (alinhado com aiQualificationConfigs)
    const cutoffDate = new Date(now - timeoutMinutes * 60 * 1000);

    // Buscar leads em processo de qualificação sem resposta após o tempo limite
    const pendingLeads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationState: schema.leads.qualificationState,
        queueId: schema.leads.queueId,
        branchId: schema.leads.branchId,
        metaCampaignId: schema.leads.metaCampaignId,
        sourceCampaign: schema.leads.sourceCampaign,
        updatedAt: schema.leads.updatedAt,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenant.id),
          eq(schema.leads.qualificationState, "IN_PROGRESS"),
          lt(schema.leads.updatedAt, cutoffDate)
        )
      );

    if (!pendingLeads.length) continue;

    const [anyMember] = await db
      .select({ userId: schema.tenantMemberships.userId })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, tenant.id), eq(schema.tenantMemberships.status, "active")))
      .limit(1);

    const systemUserId = anyMember?.userId || await resolveSystemUserId(tenant.id);

    for (const lead of pendingLeads) {
      timedOutLeadsCount += 1;
      const updateTime = new Date();

      // Check if lead replied at least once to the virtual agent / CRM
      const [incomingMessage] = await db
        .select({ id: schema.whatsappMessages.id })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, tenant.id),
            or(
              eq(schema.whatsappMessages.leadId, lead.id),
              and(isNotNull(schema.whatsappMessages.phone), eq(schema.whatsappMessages.phone, lead.telefone ?? ""))
            ),
            notInArray(schema.whatsappMessages.direction, ["outbound", "outgoing"])
          )
        )
        .limit(1);

      const hasInteracted = Boolean(incomingMessage);
      const targetQualificationStatus = hasInteracted ? "warm" : "cold";

      const campaignId = lead.metaCampaignId || lead.sourceCampaign;
      const [configuredRoute] = campaignId
        ? await db
          .select({
            queueId: schema.leadQueues.id,
            branchId: schema.leadQueues.branchId,
          })
          .from(schema.metaCampaignQueueRoutes)
          .innerJoin(schema.leadQueues, eq(schema.metaCampaignQueueRoutes.queueId, schema.leadQueues.id))
          .where(and(
            eq(schema.metaCampaignQueueRoutes.tenantId, tenant.id),
            eq(schema.metaCampaignQueueRoutes.campaignId, campaignId),
            eq(schema.metaCampaignQueueRoutes.enabled, true),
            eq(schema.leadQueues.tenantId, tenant.id),
            eq(schema.leadQueues.status, "active"),
          ))
          .limit(1)
        : [];
      const targetRoute = resolveQualificationTimeoutRoute({
        currentQueueId: lead.queueId,
        currentBranchId: lead.branchId,
        configuredRoute,
      });

      await db.transaction(async (tx) => {
        // 1. Atualizar Lead: Status Morno/Frio conforme interação + Finalizar Qualificação + Mover p/ Fila de Distribuição
        await tx
          .update(schema.leads)
          .set({
            qualificationStatus: targetQualificationStatus,
            qualificationState: "QUALIFIED",
            qualificationCompletedAt: updateTime,
            queueId: targetRoute.queueId || null,
            branchId: targetRoute.branchId,
            status: "new",
            distributionStatus: "queued",
            distributionUpdatedAt: updateTime,
            updatedAt: updateTime,
          })
          .where(eq(schema.leads.id, lead.id));

        // 2. Registrar Interação de Alerta de SLA
        await tx.insert(schema.leadInteractions).values({
          id: randomUUID(),
          leadId: lead.id,
          userId: systemUserId,
          tipo: "system_alert",
          conteudo: hasInteracted
            ? `Qualificação finalizada por estouro do tempo limite de resposta (${timeoutMinutes} min). Lead interagiu com o atendimento e foi qualificado como Morno (Warm), permanecendo na fila de distribuição configurada.`
            : `Qualificação finalizada por estouro do tempo limite de resposta (${timeoutMinutes} min). Lead não respondeu a nenhuma mensagem e foi qualificado como Frio (Cold), permanecendo na fila de distribuição configurada.`,
        });

        await tx.insert(schema.leadDistributionEvents).values({
          id: randomUUID(),
          tenantId: tenant.id,
          leadId: lead.id,
          fromBranchId: lead.branchId,
          toBranchId: targetRoute.branchId,
          toQueueId: targetRoute.queueId || null,
          action: "qualification_timeout_queued",
          source: "qualification_timeout",
          strategy: "automatic",
          reason: `Tempo de resposta da qualificação excedido (${timeoutMinutes} min).`,
          actorId: systemUserId,
          createdAt: updateTime,
        });

        // 3. Registrar Log de Auditoria
        await tx.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: systemUserId,
          entidade: "lead",
          entidadeId: lead.id,
          acao: "qualification.timeout_auto_distributed",
        });
      });

      // The durable job is created only after the queue/branch transition commits.
      // The same worker is then attempted immediately, so the handoff does not
      // wait for the periodic scheduler during commercial hours.
      await enqueueAndProcessLeadDistribution({
        tenantId: tenant.id,
        leadId: lead.id,
        source: "qualification_timeout",
      });

      // 4. Encerrar Atendimento do Robô de IA para este Lead
      const [conv] = await db
        .select({ id: schema.aiConversations.id })
        .from(schema.aiConversations)
        .where(and(eq(schema.aiConversations.leadId, lead.id), eq(schema.aiConversations.tenantId, tenant.id)))
        .limit(1);

      if (conv) {
        await transitionConversationState({
          tenantId: tenant.id,
          conversationId: conv.id,
          newStatus: "CLOSED",
          reason: `Estouro do tempo limite de qualificação (${timeoutMinutes} min sem resposta). IA encerrada.`,
        });
      }

      distributedLeadsCount += 1;
    }
  }

  return {
    tenantsChecked: tenants.length,
    timedOutLeads: timedOutLeadsCount,
    distributedLeads: distributedLeadsCount,
  };
}
