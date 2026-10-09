import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import type { AssistantId } from "@/components/chat/types";
import { ASSISTANTS, buildAncoraScript, buildAssistantScript } from "@/features/broker-workspace/chat/assistant-scripts";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

const SCRIPTED = ["leads", "plantao", "agenda", "desempenho"] as const;
type Scripted = (typeof SCRIPTED)[number];

const ANCORA_HISTORY = 30;

/** One assistant conversation of the broker chat (Âncora, Leads, Plantão, Agenda, Desempenho). */
export default async function AssistantConversationPage({ params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params;
  const context = await getRequiredTenantContext();
  if (context.role !== "broker" || (await getExperienceMode(context)) !== "LIGHT") redirect("/dashboard");
  if (!Object.hasOwn(ASSISTANTS, assistant)) notFound();
  const definition = ASSISTANTS[assistant as AssistantId];
  const identity = { name: definition.name, shape: definition.shape, hue: definition.hue };
  if (assistant === "ancora") {
    const notifications = await getDatabase()
      .select({
        id: schema.notifications.id,
        title: schema.notifications.title,
        message: schema.notifications.message,
        type: schema.notifications.type,
        readAt: schema.notifications.readAt,
        createdAt: schema.notifications.createdAt,
        leadId: schema.notifications.leadId,
      })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.tenantId, context.tenantId), eq(schema.notifications.recipientUserId, context.userId)))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(ANCORA_HISTORY);
    return <AssistantChat identity={identity} script={buildAncoraScript({ notifications, now: new Date() })} instant />;
  }
  // Cotação and Insights have their own screens.
  if (!SCRIPTED.includes(assistant as Scripted)) redirect(definition.href);
  const data = await getBrokerWorkspaceData();
  const script = buildAssistantScript(assistant as Scripted, { data, now: new Date() });
  return <AssistantChat identity={identity} script={script} />;
}
