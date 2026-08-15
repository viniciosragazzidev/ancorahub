"use server";

import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { AuthorizationError } from "@/shared/auth/errors";
import { getDatabase, schema } from "@/shared/db";
import { chooseAvailableBroker } from "@/features/leads/assignment";
import { notifyNewLead, notifyLeadArrived } from "@/features/notifications/send-push-helper";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { resolveMetaChannelCredentials } from "@/features/communication-channels/template-sync-service";
import { sendMetaCloudTemplateTest } from "@/features/communication-channels/meta-graph-templates-client";
import { enqueueMetaTextMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";

export async function forceCompleteQualificationAction(input: {
  leadId: string;
  targetQueueId?: string | null;
}) {
  try {
    const context = await getRequiredTenantContext();
    if (
      !hasCapability(context.role, "acessar_leads", context.jobTitle) &&
      !hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)
    ) {
      throw new AuthorizationError("Seu perfil não pode gerenciar a qualificação de leads.");
    }

    const db = getDatabase();

    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        branchId: schema.leads.branchId,
        queueId: schema.leads.queueId,
        qualificationStatus: schema.leads.qualificationStatus,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.tenantId, context.tenantId)
        )
      )
      .limit(1);

    if (!lead) {
      return { success: false, error: "Lead não encontrado." };
    }

    const finalQueueId = input.targetQueueId !== undefined ? input.targetQueueId : lead.queueId;
    const branchId = lead.branchId || context.branchId;

    if (!branchId) {
      return { success: false, error: "O lead precisa ter uma unidade vinculada para ser distribuído." };
    }

    const brokerId = await chooseAvailableBroker(context.tenantId, branchId);
    const assigned = Boolean(brokerId);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(schema.leads)
        .set({
          qualificationStatus: "qualified",
          qualificationState: "QUALIFIED",
          qualificationCompletedAt: now,
          status: assigned ? "distributed" : "new",
          distributionStatus: assigned ? "assigned" : "queued",
          corretorId: brokerId,
          queueId: finalQueueId,
          assignmentSource: assigned ? "manual_override" : null,
          assignmentStrategy: assigned ? "capacity" : null,
          distributionUpdatedAt: now,
          assignedAt: assigned ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.leads.id, lead.id),
            eq(schema.leads.tenantId, context.tenantId)
          )
        );

      await tx.insert(schema.leadInteractions).values({
        id: randomUUID(),
        leadId: lead.id,
        userId: context.userId,
        tipo: "system_alert",
        conteudo: "Qualificação forçada manualmente. Lead aprovado e enviado para a fila de distribuição.",
      });

      await tx.insert(schema.auditLogs).values({
        id: randomUUID(),
        userId: context.userId,
        entidade: "lead",
        entidadeId: lead.id,
        acao: "qualification.manually_completed",
      });
    });

    void notifyLeadArrived(lead.id, context.tenantId, branchId, lead.nome).catch(console.error);
    if (brokerId) {
      void notifyNewLead(lead.id, context.tenantId, branchId, brokerId, lead.nome).catch(console.error);
    } else {
      void enqueueLeadDistributionJob({ tenantId: context.tenantId, leadId: lead.id }).catch(console.error);
    }

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível concluir a qualificação do lead.",
    };
  }
}

export async function updateLeadTargetQueueAction(input: {
  leadId: string;
  queueId: string | null;
}) {
  try {
    const context = await getRequiredTenantContext();
    if (
      !hasCapability(context.role, "acessar_leads", context.jobTitle) &&
      !hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)
    ) {
      throw new AuthorizationError("Seu perfil não pode alterar a fila de destino do lead.");
    }

    const db = getDatabase();

    await db
      .update(schema.leads)
      .set({
        queueId: input.queueId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.leads.id, input.leadId),
          eq(schema.leads.tenantId, context.tenantId)
        )
      );

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: input.leadId,
      acao: "qualification.target_queue_updated",
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível alterar a fila de destino do lead.",
    };
  }
}

export async function startManualQualificationAction(input: { leadId: string }) {
  try {
    const context = await getRequiredTenantContext();
    if (
      !hasCapability(context.role, "acessar_leads", context.jobTitle) &&
      !hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)
    ) {
      throw new AuthorizationError("Seu perfil não pode disparar a qualificação de leads.");
    }

    const db = getDatabase();
    const [lead] = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        branchId: schema.leads.branchId,
      })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, context.tenantId)))
      .limit(1);

    if (!lead) {
      return { success: false, error: "Lead não encontrado." };
    }

    const now = new Date();

    // 1. Update lead qualification status
    await db
      .update(schema.leads)
      .set({
        qualificationStatus: "qualifying",
        qualificationState: "IN_PROGRESS",
        updatedAt: now,
      })
      .where(and(eq(schema.leads.id, lead.id), eq(schema.leads.tenantId, context.tenantId)));

    // 2. Ensure AI Conversation row exists and set AI_ACTIVE
    const [existingConv] = await db
      .select({ id: schema.aiConversations.id })
      .from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.tenantId, context.tenantId), eq(schema.aiConversations.leadId, lead.id)))
      .limit(1);

    const conversationId = existingConv?.id || randomUUID();
    if (existingConv) {
      await db
        .update(schema.aiConversations)
        .set({
          automationState: "AI_ACTIVE",
          status: "WAITING_CUSTOMER",
          updatedAt: now,
        })
        .where(and(eq(schema.aiConversations.id, existingConv.id), eq(schema.aiConversations.tenantId, context.tenantId)));
    } else {
      await db.insert(schema.aiConversations).values({
        id: conversationId,
        tenantId: context.tenantId,
        leadId: lead.id,
        automationState: "AI_ACTIVE",
        status: "WAITING_CUSTOMER",
        createdAt: now,
        updatedAt: now,
      });
    }

    // 3. Try sending official Meta WhatsApp template lead_qualification_start
    let dispatchedViaTemplate = false;
    try {
      const credentials = await resolveMetaChannelCredentials(context.tenantId);
      const [template] = await db
        .select()
        .from(schema.metaWhatsAppTemplates)
        .where(
          and(
            eq(schema.metaWhatsAppTemplates.tenantId, context.tenantId),
            eq(schema.metaWhatsAppTemplates.name, "lead_qualification_start"),
            eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
            isNull(schema.metaWhatsAppTemplates.deletedAt),
          ),
        )
        .limit(1);

      if (template && credentials.phoneNumberId) {
        const bodyComp = (template.componentsJson as any[])?.find((c: any) => c.type === "BODY");
        const namedParams = bodyComp?.example?.body_text_named_params;
        const components = [
          {
            type: "body",
            parameters:
              namedParams && namedParams.length > 0
                ? [
                    { type: "text", parameter_name: "nome", text: lead.nome },
                    { type: "text", parameter_name: "empresa", text: "Âncora Saúde" },
                  ]
                : [
                    { type: "text", text: lead.nome },
                    { type: "text", text: "Âncora Saúde" },
                  ],
          },
        ];

        await sendMetaCloudTemplateTest(
          credentials.phoneNumberId,
          credentials.accessToken,
          lead.telefone,
          template.name,
          template.language,
          components,
        );
        dispatchedViaTemplate = true;
      }
    } catch (templateError) {
      console.warn("[startManualQualificationAction] Falha no disparo de template oficial Meta, executando fallback de texto:", templateError);
    }

    // Fallback text if template dispatch failed or no approved template
    if (!dispatchedViaTemplate) {
      const bodyText = `Olá, *${lead.nome}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela Âncora Saúde.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?`;
      await enqueueMetaTextMessage({
        tenantId: context.tenantId,
        recipientType: "lead",
        recipientId: lead.id,
        destinationPhone: lead.telefone,
        body: bodyText,
        idempotencyKey: `manual_qual_${lead.id}_${now.getTime()}`,
      });
      await processMetaOutboundBatch(10, context.tenantId).catch(() => undefined);
    }

    const initialText = `Olá, *${lead.nome}*!😀\nRecebemos sua solicitação de atendimento sobre planos de saúde pela Âncora Saúde.⚓\nPara encaminhar você ao especialista mais adequado, gostaríamos de fazer algumas perguntas rápidas por aqui.⚡\nComo deseja continuar?`;

    await db.insert(schema.whatsappMessages).values({
      id: randomUUID(),
      tenantId: context.tenantId,
      leadId: lead.id,
      conversationId,
      senderRole: "assistant",
      provider: "meta",
      phone: lead.telefone,
      direction: "outbound",
      body: initialText,
      providerStatus: "sent",
      sentAt: now,
    }).catch(() => undefined);

    // 4. Log interaction and audit
    await db.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId: lead.id,
      userId: context.userId,
      tipo: "system_alert",
      conteudo: "Qualificação por Agente de IA iniciada manualmente. Primeira mensagem enviada no WhatsApp.",
    });

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "lead",
      entidadeId: lead.id,
      acao: "qualification.manually_started",
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${lead.id}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível iniciar a qualificação do lead.",
    };
  }
}
