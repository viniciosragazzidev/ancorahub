import "server-only";

import { and, eq, inArray, isNotNull, lt, notInArray, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { transitionConversationState } from "./conversation-state-machine";

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

    const timeoutMinutes = Math.max(5, config?.timeoutMinutes ?? 20); // Default 20 minutos
    const cutoffDate = new Date(now - timeoutMinutes * 60 * 1000);

    // Buscar leads em processo de qualificação sem resposta após o tempo limite
    const pendingLeads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        qualificationStatus: schema.leads.qualificationStatus,
        qualificationState: schema.leads.qualificationState,
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

      await db.transaction(async (tx) => {
        // 1. Atualizar Lead: Status Morno/Frio conforme interação + Finalizar Qualificação + Mover p/ Fila de Distribuição
        await tx
          .update(schema.leads)
          .set({
            qualificationStatus: targetQualificationStatus,
            qualificationState: "QUALIFIED",
            qualificationCompletedAt: updateTime,
            status: "distributed",
            distributionStatus: "queued",
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
            ? `Qualificação finalizada por estouro do tempo limite de resposta (${timeoutMinutes} min). Lead interagiu com o atendimento e foi qualificado como Morno (Warm), sendo transferido para a Fila de Distribuição.`
            : `Qualificação finalizada por estouro do tempo limite de resposta (${timeoutMinutes} min). Lead não respondeu a nenhuma mensagem e foi qualificado como Frio (Cold), sendo transferido para a Fila de Distribuição.`,
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
