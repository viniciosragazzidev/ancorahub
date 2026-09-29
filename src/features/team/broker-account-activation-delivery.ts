import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

export type BrokerAccountActivationNoticeStatus = "queued" | "not_available" | "failed";

type BrokerAccountActivationNoticeInput = {
  tenantId: string;
  invitationId: string;
  memberName: string;
  requestedBy?: string | null;
};

async function writeActivationNoticeAudit(input: {
  tenantId: string;
  requestedBy?: string | null;
  action: string;
  outboundId?: string;
}) {
  const db = getDatabase();
  const userId = input.requestedBy ?? await resolveSystemUserId(input.tenantId);
  await db.insert(schema.auditLogs).values({
    id: randomUUID(),
    userId,
    entidade: "broker_account_activation_notice",
    entidadeId: input.outboundId ?? input.tenantId,
    acao: input.action,
    createdAt: new Date(),
  });
}

/**
 * Queues the post-onboarding confirmation without making activation depend on
 * Meta. The sender channel is read from the original invitation outbox row;
 * no current default channel is substituted when that binding is unavailable.
 */
export async function enqueueBrokerAccountActivationNotice(
  input: BrokerAccountActivationNoticeInput,
): Promise<BrokerAccountActivationNoticeStatus> {
  const enabled = await getFeatureFlag(FEATURE_FLAGS.BROKER_ACCOUNT_ACTIVATION_NOTICE).catch(() => "true");
  if (enabled === "false") {
    await writeActivationNoticeAudit({ ...input, action: "broker_account_activation_notice_disabled" });
    return "not_available";
  }

  const db = getDatabase();
  const [invitationOutbound] = await db.select({
    channelId: schema.whatsappOutboundMessages.channelId,
    destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
    eq(schema.whatsappOutboundMessages.recipientType, "user"),
    eq(schema.whatsappOutboundMessages.recipientId, input.invitationId),
    eq(schema.whatsappOutboundMessages.purpose, "brokerInvitation"),
  )).orderBy(desc(schema.whatsappOutboundMessages.createdAt)).limit(1);

  if (!invitationOutbound?.channelId) {
    await writeActivationNoticeAudit({ ...input, action: "broker_account_activation_notice_channel_unavailable" });
    return "not_available";
  }

  const [tenant] = await db.select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, input.tenantId))
    .limit(1);
  const loginUrl = process.env.CRM_LOGIN_URL?.trim() || "https://crm.ancorasaude.cloud/login";

  try {
    const queued = await enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      channelId: invitationOutbound.channelId,
      recipientType: "user",
      // Keep the invitation id as the durable correlation key. It lets the
      // worker/audit trail link both messages without exposing the user id.
      recipientId: input.invitationId,
      // Keep the same recipient number used by the invitation as well as the
      // same sender channel. The onboarding form may contain a corrected
      // number, but it must not silently redirect this lifecycle notice.
      destinationPhone: invitationOutbound.destinationPhone,
      purpose: "brokerAccountActivated",
      variables: [input.memberName, tenant?.name ?? "Âncora", loginUrl],
      requestedBy: input.requestedBy,
      idempotencyKey: `broker-account-activated:${input.tenantId}:${input.invitationId}`,
    });

    await writeActivationNoticeAudit({
      ...input,
      action: queued.duplicate ? "broker_account_activation_notice_duplicate" : "broker_account_activation_notice_queued",
      outboundId: queued.id,
    });

    if (!queued.duplicate && queued.status === "queued") {
      scheduleAfterResponse("broker-account-activation-outbound", () => processMetaOutboundBatch(1, input.tenantId, queued.id));
    }
    return "queued";
  } catch {
    await writeActivationNoticeAudit({ ...input, action: "broker_account_activation_notice_failed" });
    return "failed";
  }
}
