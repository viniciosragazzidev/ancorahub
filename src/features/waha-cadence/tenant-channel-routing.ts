import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getMessageEventByPurpose } from "@/features/communication-channels/message-event-catalog";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";
import {
  EMPTY_TENANT_CHANNEL_ROUTING,
  isTenantChannelRoutableEvent,
  normalizeTenantChannelRouting,
  renderTenantChannelMessage,
  type TenantChannelRouting,
} from "./tenant-channel-routing-rules";

/** Connected company-number statuses: relay vocabulary ("active") and rows written as "ready". */
export const TENANT_CHANNEL_CONNECTED_STATUSES = ["active", "ready"];

/** The tenant's company number (WhatsApp da diretoria) when it is connected, else null. */
export async function findConnectedTenantChannelId(tenantId: string): Promise<string | null> {
  const [channel] = await getDatabase().select({ id: schema.wahaNumbers.id }).from(schema.wahaNumbers)
    .where(and(eq(schema.wahaNumbers.tenantId, tenantId), eq(schema.wahaNumbers.scope, "tenant"), inArray(schema.wahaNumbers.status, TENANT_CHANNEL_CONNECTED_STATUSES)))
    .orderBy(desc(schema.wahaNumbers.createdAt))
    .limit(1);
  return channel?.id ?? null;
}

export function tenantChannelRoutingKey(tenantId: string) {
  return `tenant_channel_routing_${tenantId}`;
}

export async function getTenantChannelRouting(tenantId: string): Promise<TenantChannelRouting> {
  try {
    const stored = await getSystemSetting(tenantChannelRoutingKey(tenantId));
    return stored ? normalizeTenantChannelRouting(JSON.parse(stored)) : EMPTY_TENANT_CHANNEL_ROUTING;
  } catch {
    return EMPTY_TENANT_CHANNEL_ROUTING;
  }
}

/**
 * Whether a broker notice should leave through the company number, and with
 * which text. Null keeps the Meta path: event not routed, number not
 * connected, message inactive or rendered empty.
 */
export async function resolveTenantChannelDelivery(input: {
  tenantId: string;
  purpose: string;
  variables: readonly string[];
}): Promise<{ wahaNumberId: string; text: string } | null> {
  const event = getMessageEventByPurpose(input.purpose);
  if (!event || !isTenantChannelRoutableEvent(event.key)) return null;
  const routing = await getTenantChannelRouting(input.tenantId);
  const messageId = routing.events[event.key];
  if (!messageId) return null;

  const db = getDatabase();
  const channelId = await findConnectedTenantChannelId(input.tenantId);
  if (!channelId) return null;
  const [message] = await db.select({ content: schema.messageTemplates.content }).from(schema.messageTemplates)
    .where(and(eq(schema.messageTemplates.id, messageId), eq(schema.messageTemplates.tenantId, input.tenantId), eq(schema.messageTemplates.active, true)))
    .limit(1);
  if (!message) return null;

  const text = renderTenantChannelMessage(event, message.content, input.variables);
  return text ? { wahaNumberId: channelId, text } : null;
}
