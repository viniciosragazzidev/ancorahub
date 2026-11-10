import "server-only";

import { and, eq } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { publishNotification } from "@/features/notifications/send-push-helper";
import { getDatabase, schema } from "@/shared/db";
import {
  closingStageInAppNotice,
  closingStageNoticeKey,
  closingStageNoticeVariables,
  entersClosingStage,
} from "./closing-stage-notice-core";

/**
 * Congratulates the broker when their lead enters the closing stage: a
 * WhatsApp notice (channel chosen in Avisos da equipe, company number with
 * Meta as the fallback by default) plus the in-app toast and push. Once per
 * lead and broker, through the unique idempotency keys. Never throws: the
 * status change is already saved.
 */
async function deliverBrokerClosingStageNotice(input: {
  tenantId: string;
  leadId: string;
  leadName: string | null;
  brokerId: string | null;
  requestedBy?: string | null;
  /** Outro envio do mesmo pedido (venda detectada pela IA): chave própria, para não colidir com o aviso de entrada. */
  idempotencyKey?: string;
  /** Texto do app e do push no lugar do padrão (o WhatsApp segue o texto do aviso). */
  inApp?: { title: string; message: string; pushTitle: string; pushBody: string };
  capability?: "lead_closing_stage" | "lead_converted";
}) {
  const brokerId = input.brokerId;
  if (!brokerId) return { notified: false as const };
  const key = input.idempotencyKey ?? closingStageNoticeKey(input.leadId, brokerId);
  try {
    const [broker] = await getDatabase()
      .select({ name: schema.user.name, phone: schema.brokerProfiles.phone })
      .from(schema.user)
      .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, input.tenantId)))
      .where(eq(schema.user.id, brokerId))
      .limit(1);
    const phone = broker?.phone?.trim();
    const inApp = input.inApp ?? closingStageInAppNotice(input.leadName);
    const settled = await Promise.allSettled([
      phone
        ? enqueueMetaTemplateMessage({
          tenantId: input.tenantId,
          recipientType: "user",
          recipientId: brokerId,
          destinationPhone: phone,
          purpose: "leadClosingStage",
          variables: closingStageNoticeVariables({ brokerName: broker?.name ?? null, leadName: input.leadName, leadId: input.leadId }),
          requestedBy: input.requestedBy ?? null,
          idempotencyKey: key,
        }).then((queued) => (queued.duplicate || (queued.status as string) === "skipped"
          ? null
          // Exact-id dispatch: an older queued message never takes this one's place.
          : processMetaOutboundBatch(1, input.tenantId, queued.id)))
        : Promise.resolve(null),
      publishNotification({
        capability: input.capability ?? "lead_closing_stage",
        tenantId: input.tenantId,
        recipientUserId: brokerId,
        leadId: input.leadId,
        type: input.capability ?? "lead_closing_stage",
        ...inApp,
        url: `/leads/${input.leadId}`,
        tag: `lead-${input.leadId}`,
        idempotencyKey: key,
      }),
    ]);
    settled.forEach((item) => {
      if (item.status === "rejected") console.warn("[closing-stage] notice_failed", { leadId: input.leadId, error: item.reason instanceof Error ? item.reason.message.slice(0, 200) : "unknown" });
    });
    return { notified: true as const };
  } catch (error) {
    console.error("[closing-stage] failed", { leadId: input.leadId, error: error instanceof Error ? error.message.slice(0, 200) : "unknown" });
    return { notified: false as const };
  }
}

export async function notifyBrokerClosingStage(input: {
  tenantId: string;
  leadId: string;
  leadName: string | null;
  brokerId: string | null;
  previousStatus: string;
  newStatus: string;
}) {
  if (!input.brokerId || !entersClosingStage(input.previousStatus, input.newStatus)) return { notified: false as const };
  return deliverBrokerClosingStageNotice(input);
}

/** Explicit, audited recovery for a lead already in a closing stage before the notice existed. */
export async function manuallyNotifyBrokerClosingStage(input: {
  tenantId: string;
  leadId: string;
  leadName: string | null;
  brokerId: string | null;
  requestedBy: string;
}) {
  return deliverBrokerClosingStageNotice(input);
}

/**
 * Venda detectada pela IA (10/11): o mesmo pedido de registro que a direção manda à mão (WhatsApp do aviso
 * "Lead na etapa de fechamento" + app), com os parabéns pela venda e o que falta. Uma vez por lead e corretor
 * pela chave própria.
 */
export async function notifyBrokerAiSaleDocuments(input: {
  tenantId: string;
  leadId: string;
  leadName: string | null;
  brokerId: string | null;
  idempotencyKey: string;
  inApp: { title: string; message: string; pushTitle: string; pushBody: string };
}) {
  return deliverBrokerClosingStageNotice({ ...input, capability: "lead_converted" });
}
