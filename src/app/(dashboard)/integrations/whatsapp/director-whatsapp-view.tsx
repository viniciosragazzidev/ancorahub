import { and, desc, eq } from "drizzle-orm";

import { getMessageEventByKey } from "@/features/communication-channels/message-event-catalog";
import { getTenantChannel } from "@/features/waha-cadence/tenant-channel";
import { getTenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing";
import { TENANT_CHANNEL_ROUTABLE_EVENTS } from "@/features/waha-cadence/tenant-channel-routing-rules";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { TenantChannelCard } from "../whats_alt/_components/tenant-channel-card";
import { TenantChannelRoutingCard, type RoutableEventItem } from "../whats_alt/_components/tenant-channel-routing-card";
import { WhatsAppIntegrationHeading } from "./whatsapp-integration-heading";

export async function DirectorWhatsAppView({ context }: { context: TenantContext }) {
  const [channel, routing, freeMessages] = await Promise.all([
    getTenantChannel(context),
    getTenantChannelRouting(context.tenantId),
    getDatabase()
      .select({
        id: schema.messageTemplates.id,
        name: schema.messageTemplates.name,
        category: schema.messageTemplates.category,
        content: schema.messageTemplates.content,
        variables: schema.messageTemplates.variables,
      })
      .from(schema.messageTemplates)
      .where(and(eq(schema.messageTemplates.tenantId, context.tenantId), eq(schema.messageTemplates.active, true)))
      .orderBy(desc(schema.messageTemplates.updatedAt)),
  ]);

  const events: RoutableEventItem[] = TENANT_CHANNEL_ROUTABLE_EVENTS.flatMap((key) => {
    const event = getMessageEventByKey(key);
    return event ? [{ key, label: event.label, description: event.description }] : [];
  });

  return <main className="flex min-h-full flex-col gap-5 bg-background p-(--mobile-page-padding) antialiased sm:gap-6 lg:p-6">
    <WhatsAppIntegrationHeading active="diretoria" canViewDirector />
    <div className="mx-auto grid w-full max-w-7xl gap-5 sm:gap-6">
      <TenantChannelCard initialChannel={channel} />
      <TenantChannelRoutingCard
        events={events}
        freeMessages={freeMessages.map((message) => ({
          ...message,
          variables: Array.isArray(message.variables) ? message.variables.map(String) : [],
        }))}
        initialRouting={routing}
        channelConnected={channel?.status === "ready"}
      />
    </div>
  </main>;
}
