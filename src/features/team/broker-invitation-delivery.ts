import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { enqueueMetaTemplateMessage, processMetaOutboundBatch } from "@/features/communication-channels/outbound-service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { scheduleAfterResponse } from "@/shared/async/after-response";
import { getDatabase, schema } from "@/shared/db";

type BrokerInvitationDeliveryInput = {
  tenantId: string;
  branchId: string;
  invitationId: string;
  destinationPhone: string;
  name: string;
  jobTitle: string;
  role: string;
  requestedBy: string;
  scheduleDelivery?: boolean;
};

export async function enqueueBrokerInvitation(
  input: BrokerInvitationDeliveryInput,
): Promise<"queued" | "not_available" | "failed"> {
  const db = getDatabase();
  const [channel] = await db.select({ id: schema.communicationChannels.id })
    .from(schema.communicationChannels)
    .where(and(
      eq(schema.communicationChannels.tenantId, input.tenantId),
      inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
      eq(schema.communicationChannels.status, "active"),
    ))
    .orderBy(sql`CASE WHEN ${schema.communicationChannels.isDefault} = true THEN 0 ELSE 1 END`)
    .limit(1);

  if (!channel) {
    await db.update(schema.brokerInvitations)
      .set({ deliveryStatus: "not_available", deliveryError: "Canal oficial do WhatsApp indisponível." })
      .where(and(eq(schema.brokerInvitations.id, input.invitationId), eq(schema.brokerInvitations.tenantId, input.tenantId)));
    return "not_available" as const;
  }

  const [company, branch] = await Promise.all([
    db.select({ name: schema.tenants.name }).from(schema.tenants).where(eq(schema.tenants.id, input.tenantId)).limit(1),
    db.select({ name: schema.branches.name }).from(schema.branches).where(and(
      eq(schema.branches.id, input.branchId),
      eq(schema.branches.tenantId, input.tenantId),
    )).limit(1),
  ]);
  const roleLabel = input.jobTitle === "director" || input.role === "director"
    ? "Diretor"
    : input.jobTitle === "manager"
      ? "Gestor"
      : input.jobTitle === "broker"
        ? "Corretor"
        : input.jobTitle;

  try {
    const queued = await enqueueMetaTemplateMessage({
      tenantId: input.tenantId,
      channelId: channel.id,
      recipientType: "user",
      recipientId: input.invitationId,
      destinationPhone: input.destinationPhone,
      purpose: "brokerInvitation",
      variables: [input.name, company[0]?.name ?? "sua corretora", roleLabel, branch[0]?.name ?? "Unidade"],
      requestedBy: input.requestedBy,
      idempotencyKey: `team-invitation:${input.invitationId}`,
    });
    const status: "queued" | "failed" = queued.duplicate || queued.status === "queued" ? "queued" : "failed";
    await db.update(schema.brokerInvitations)
      .set({ deliveryStatus: status, deliveryError: status === "failed" ? "Não foi possível enfileirar o convite." : null })
      .where(and(eq(schema.brokerInvitations.id, input.invitationId), eq(schema.brokerInvitations.tenantId, input.tenantId)));
    if (status === "queued" && input.scheduleDelivery !== false) {
      scheduleAfterResponse("team-invitation-outbound", () => processMetaOutboundBatch(3, input.tenantId));
    }
    return status;
  } catch {
    await db.update(schema.brokerInvitations)
      .set({ deliveryStatus: "failed", deliveryError: "Não foi possível enfileirar o convite." })
      .where(and(eq(schema.brokerInvitations.id, input.invitationId), eq(schema.brokerInvitations.tenantId, input.tenantId)));
    return "failed" as const;
  }
}
