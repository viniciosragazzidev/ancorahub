import { and, desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import type { AssistantId } from "@/components/chat/types";
import { MarkSeenOnView } from "@/components/chat/mark-seen-on-view";
import { ASSISTANTS, SUPERVISOR_ASSISTANTS, buildAncoraScript } from "@/features/broker-workspace/chat/assistant-scripts";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import { getWhatsAppConnection } from "@/app/(dashboard)/settings/whatsapp-actions";
import { WhatsAppPlantaoNotice } from "@/components/whatsapp/whatsapp-plantao-notice";

export const dynamic = "force-dynamic";

const ANCORA_HISTORY = 30;

/** Jack remains the only assistant conversation; previous assistant URLs redirect to work pages. */
export default async function AssistantConversationPage({ params }: { params: Promise<{ assistant: string }> }) {
  const { assistant } = await params;
  const context = await getRequiredTenantContext();
  const audience = context.role === "supervisor" ? await getLiteAudience(context) : context.role === "broker" && (await getExperienceMode(context)) === "LIGHT" ? "broker" : null;
  if (!audience) redirect("/dashboard");
  if (!Object.hasOwn(ASSISTANTS, assistant)) notFound();
  const supervisorOnly = (SUPERVISOR_ASSISTANTS as readonly string[]).includes(assistant);
  // Each audience only has its own assistants (Âncora is shared).
  if (audience === "broker" && supervisorOnly) notFound();
  if (audience === "supervisor" && assistant !== "ancora" && !supervisorOnly) notFound();
  const definition = ASSISTANTS[assistant as AssistantId];
  if (assistant !== "ancora") redirect(definition.href);
  const identity = { name: definition.name, shape: definition.shape, hue: definition.hue };

  const [notifications, noticeFlag, whatsappConnection] = await Promise.all([
    getDatabase()
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
      .limit(ANCORA_HISTORY),
    audience === "broker" ? getFeatureFlag(FEATURE_FLAGS.WHATSAPP_PLANTAO_NOTICE).catch(() => "false") : Promise.resolve("false"),
    audience === "broker" ? getWhatsAppConnection().catch(() => null) : Promise.resolve(null),
  ]);
  const hasUnread = notifications.some((item) => !item.readAt);
  const topNotice = audience === "broker"
    && noticeFlag === "true"
    && whatsappConnection
    && whatsappConnection.status !== "ready"
    ? <WhatsAppPlantaoNotice userId={context.userId} mode="sticky" />
    : undefined;
  return (
    <>
      <AssistantChat key="ancora" identity={identity} script={buildAncoraScript({ notifications, now: new Date() })} instant agentId={audience === "broker" ? "ancora" : undefined} canWrite={audience === "broker"} topNotice={topNotice} />
      {hasUnread ? <MarkSeenOnView kind="ancora" /> : null}
    </>
  );
}
