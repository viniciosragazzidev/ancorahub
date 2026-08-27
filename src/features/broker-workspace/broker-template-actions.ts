"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import {
  enqueueMetaTextMessage,
  processMetaOutboundBatch,
} from "@/features/communication-channels/outbound-service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";

const sendBrokerTemplateSchema = z.object({
  brokerProfileIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um corretor."),
  templateType: z.enum(["meta", "free", "custom"]),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  content: z.string().min(1, "O conteúdo da mensagem não pode estar vazio.").max(4096),
});

export type SendBrokerTemplateInput = z.infer<typeof sendBrokerTemplateSchema>;

export async function sendBrokerTemplateAction(input: SendBrokerTemplateInput) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Permissão negada. Apenas diretores e gestores podem disparar templates para a equipe." };
    }

    const parsed = sendBrokerTemplateSchema.parse(input);
    const db = getDatabase();

    // 1. Buscar os corretores no banco
    const brokers = await db
      .select({
        id: schema.brokerProfiles.id,
        userId: schema.brokerProfiles.userId,
        name: schema.brokerProfiles.professionalName,
        phone: schema.brokerProfiles.phone,
      })
      .from(schema.brokerProfiles)
      .where(
        and(
          eq(schema.brokerProfiles.tenantId, context.tenantId),
          inArray(schema.brokerProfiles.id, parsed.brokerProfileIds)
        )
      );

    if (!brokers.length) {
      return { success: false, error: "Nenhum corretor válido foi encontrado para envio." };
    }

    // 2. Buscar canal ativo corporativo
    const [channel] = await db
      .select({ id: schema.communicationChannels.id })
      .from(schema.communicationChannels)
      .where(
        and(
          eq(schema.communicationChannels.tenantId, context.tenantId),
          eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
          eq(schema.communicationChannels.status, "active")
        )
      )
      .limit(1);

    if (!channel) {
      return { success: false, error: "Nenhum canal Meta Cloud WhatsApp ativo foi encontrado." };
    }

    let sentCount = 0;
    let failCount = 0;

    for (const broker of brokers) {
      if (!broker.phone) {
        failCount++;
        continue;
      }

      // Substituição de variáveis no texto
      const formattedBody = parsed.content
        .replace(/\{\{\s*nome\s*\}\}/gi, broker.name || "Corretor")
        .replace(/\{\{\s*empresa\s*\}\}/gi, "Âncora Corretora")
        .replace(/\{\{\s*telefone\s*\}\}/gi, broker.phone);

      const idempotencyKey = `broker-template:${broker.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;

      try {
        await enqueueMetaTextMessage({
          tenantId: context.tenantId,
          channelId: channel.id,
          recipientType: "user",
          recipientId: broker.userId ?? broker.id,
          destinationPhone: broker.phone,
          body: formattedBody,
          requestedBy: context.userId,
          idempotencyKey,
        });
        sentCount++;
      } catch (err) {
        console.error("[sendBrokerTemplateAction] erro ao enfileirar para corretor", broker.id, err);
        failCount++;
      }
    }

    // Processar batch imediatamente
    processMetaOutboundBatch(10, context.tenantId).catch(() => {});

    // Registrar log de auditoria
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "official_broker_conversations",
      entidadeId: context.tenantId,
      acao: `disparo_template_corretores:${parsed.templateType}:${sentCount}_enviados`,
    });

    return {
      success: true,
      sentCount,
      failCount,
      message: `${sentCount} mensagem(ns) enviada(s) com sucesso para a equipe.${failCount > 0 ? ` (${failCount} falhou por telefone inválido)` : ""}`,
    };
  } catch (error) {
    console.error("[sendBrokerTemplateAction] error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar envio de template para corretores.",
    };
  }
}

export async function sendBrokerDirectMessageAction(input: { brokerProfileId: string; body: string }) {
  try {
    const context = await getRequiredTenantContext();
    if (context.role !== "director" && context.role !== "manager") {
      return { success: false, error: "Permissão negada." };
    }

    const body = input.body.trim();
    if (!body) return { success: false, error: "Mensagem vazia." };

    const db = getDatabase();
    const [broker] = await db
      .select({
        id: schema.brokerProfiles.id,
        userId: schema.brokerProfiles.userId,
        name: schema.brokerProfiles.professionalName,
        phone: schema.brokerProfiles.phone,
      })
      .from(schema.brokerProfiles)
      .where(
        and(
          eq(schema.brokerProfiles.tenantId, context.tenantId),
          eq(schema.brokerProfiles.id, input.brokerProfileId)
        )
      )
      .limit(1);

    if (!broker?.phone) {
      return { success: false, error: "Corretor não possui número de telefone válido cadastrado." };
    }

    const [channel] = await db
      .select({ id: schema.communicationChannels.id })
      .from(schema.communicationChannels)
      .where(
        and(
          eq(schema.communicationChannels.tenantId, context.tenantId),
          eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
          eq(schema.communicationChannels.status, "active")
        )
      )
      .limit(1);

    if (!channel) {
      return { success: false, error: "Canal oficial de WhatsApp não está ativo." };
    }

    const idempotencyKey = `broker-direct:${broker.id}:${Date.now()}`;

    await enqueueMetaTextMessage({
      tenantId: context.tenantId,
      channelId: channel.id,
      recipientType: "user",
      recipientId: broker.userId ?? broker.id,
      destinationPhone: broker.phone,
      body,
      requestedBy: context.userId,
      idempotencyKey,
    });

    processMetaOutboundBatch(10, context.tenantId).catch(() => {});

    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: context.userId,
      entidade: "official_broker_conversations",
      entidadeId: broker.id,
      acao: "mensagem_direta_corretor_enviada",
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao enviar mensagem direta ao corretor.",
    };
  }
}
