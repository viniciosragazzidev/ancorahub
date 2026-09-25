import { and, desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { getMessageEventByKey } from "@/features/communication-channels/message-event-catalog";
import { getTenantChannel } from "@/features/waha-cadence/tenant-channel";
import { getTenantChannelRouting } from "@/features/waha-cadence/tenant-channel-routing";
import { TENANT_CHANNEL_ROUTABLE_EVENTS } from "@/features/waha-cadence/tenant-channel-routing-rules";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { TenantChannelCard } from "./_components/tenant-channel-card";
import { TenantChannelRoutingCard, type RoutableEventItem } from "./_components/tenant-channel-routing-card";

export const dynamic = "force-dynamic";

/**
 * Número da empresa via WAHA (canal da diretoria com os corretores). Separado
 * da API oficial Meta, que segue com as notificações oficiais, e das conexões
 * pessoais dos corretores.
 */
export default async function WhatsAltIntegrationPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/integrations");

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

  return (
    <>
      <DashboardHeader breadcrumb="Integrações" title="WhatsApp da diretoria" />
      <main className="flex flex-1 flex-col gap-6 p-(--mobile-page-padding) lg:p-6">
        <div className="grid max-w-4xl gap-6">
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
      </main>
    </>
  );
}
