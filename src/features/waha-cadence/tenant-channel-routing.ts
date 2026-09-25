import "server-only";

import { and, desc, eq } from "drizzle-orm";

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
  const [channel] = await db.select({ id: schema.wahaNumbers.id }).from(schema.wahaNumbers)
    .where(and(eq(schema.wahaNumbers.tenantId, input.tenantId), eq(schema.wahaNumbers.scope, "tenant"), eq(schema.wahaNumbers.status, "active")))
    .orderBy(desc(schema.wahaNumbers.createdAt))
    .limit(1);
  if (!channel) return null;
  const [message] = await db.select({ content: schema.messageTemplates.content }).from(schema.messageTemplates)
    .where(and(eq(schema.messageTemplates.id, messageId), eq(schema.messageTemplates.tenantId, input.tenantId), eq(schema.messageTemplates.active, true)))
    .limit(1);
  if (!message) return null;

  const text = renderTenantChannelMessage(event, message.content, input.variables);
  return text ? { wahaNumberId: channel.id, text } : null;
}
