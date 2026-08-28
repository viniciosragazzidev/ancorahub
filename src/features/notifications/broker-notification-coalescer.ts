import "server-only";

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { enqueueMetaTextMessage } from "@/features/communication-channels/outbound-service";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

/**
 * Coalescing window in milliseconds.
 * If multiple leads are assigned to the same broker within this window,
 * we send 1 initial detailed template + 1 summary message for extra leads.
 */
export const BROKER_COALESCE_WINDOW_MS = 3 * 60_000; // 3 minutes

export type CoalesceCheckResult = {
  shouldCoalesce: boolean;
  recentLeadNotificationsCount: number;
  lastNotificationTime: Date | null;
};

/**
 * Checks if a broker has received a lead notification in the coalesce window.
 */
export async function checkBrokerNotificationCoalesceWindow(input: {
  tenantId: string;
  brokerId: string;
  now?: Date;
  windowMs?: number;
}): Promise<CoalesceCheckResult> {
  const db = getDatabase();
  const now = input.now ?? new Date();
  const windowMs = input.windowMs ?? BROKER_COALESCE_WINDOW_MS;
  const since = new Date(now.getTime() - windowMs);

  const recentMessages = await db
    .select({
      id: schema.whatsappOutboundMessages.id,
      createdAt: schema.whatsappOutboundMessages.createdAt,
    })
    .from(schema.whatsappOutboundMessages)
    .where(
      and(
        eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
        eq(schema.whatsappOutboundMessages.recipientId, input.brokerId),
        eq(schema.whatsappOutboundMessages.purpose, "brokerLeadNotification"),
        gte(schema.whatsappOutboundMessages.createdAt, since),
        inArray(schema.whatsappOutboundMessages.status, [
          "pending",
          "queued",
          "processing",
          "sent",
          "delivered",
          "read",
        ]),
      ),
    )
    .orderBy(desc(schema.whatsappOutboundMessages.createdAt));

  const recentCount = recentMessages.length;
  const lastTime = recentMessages[0]?.createdAt ?? null;

  return {
    shouldCoalesce: recentCount >= 1,
    recentLeadNotificationsCount: recentCount,
    lastNotificationTime: lastTime,
  };
}

/**
 * Sends or updates a single freeform WhatsApp summary message for batch lead assignments.
 */
export async function enqueueBrokerBatchSummaryNotification(input: {
  tenantId: string;
  brokerId: string;
  destinationPhone: string;
}) {
  const now = new Date();
  const requestedBy = await resolveSystemUserId(input.tenantId);
  const dateKey = now.toISOString().slice(0, 16); // Minute resolution key to group batch
  const idempotencyKey = `broker-summary:${input.brokerId}:${dateKey}`;

  const messageBody =
    `📢 *Novos leads atribuídos!*\n\n` +
    `Você recebeu novos leads em sua carteira.\n` +
    `Acesse seu painel em /leads para iniciar os atendimentos.`;

  return enqueueMetaTextMessage({
    tenantId: input.tenantId,
    recipientType: "user",
    recipientId: input.brokerId,
    destinationPhone: input.destinationPhone,
    body: messageBody,
    requestedBy,
    idempotencyKey,
  });
}
