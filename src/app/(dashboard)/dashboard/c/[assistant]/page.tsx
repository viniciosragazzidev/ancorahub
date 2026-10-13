import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AssistantChat } from "@/components/chat/assistant-chat";
import type { AssistantId } from "@/components/chat/types";
import { MarkSeenOnView } from "@/components/chat/mark-seen-on-view";
import { ASSISTANTS, SUPERVISOR_ASSISTANTS, buildAncoraScript, buildAssistantScript, buildJourneyScript } from "@/features/broker-workspace/chat/assistant-scripts";
import { getCachedSupervisorWorkspaceData, getCachedBrokerJourneyData } from "@/features/broker-workspace/chat/chat-rail-data";
import { buildSupervisorScript, type SupervisorScriptId } from "@/features/supervisor-workspace/chat";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getJourneyDailySummaries } from "@/features/engagement/journey-queries";
import { FEATURE_FLAGS, getFeatureFlag } from "@/features/system-settings/queries";
import chatStyles from "@/components/chat/chat.module.css";

export const dynamic = "force-dynamic";

const SCRIPTED = ["leads", "plantao", "agenda", "desempenho"] as const;
type Scripted = (typeof SCRIPTED)[number];

const ANCORA_HISTORY = 30;

/** One assistant conversation of the broker chat (Âncora, Leads, Plantão, Agenda, Desempenho). */
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
    const hasUnread = notifications.some((item) => !item.readAt);
    return (
      <>
        <AssistantChat identity={identity} script={buildAncoraScript({ notifications, now: new Date() })} instant agentId={audience === "broker" ? "ancora" : undefined} canWrite={audience === "broker"} />
        {hasUnread ? <MarkSeenOnView kind="ancora" /> : null}
      </>
    );
  }
  if (audience === "supervisor") {
    const data = await getCachedSupervisorWorkspaceData();
    return <AssistantChat identity={identity} script={buildSupervisorScript(assistant as SupervisorScriptId, data, new Date())} />;
  }
  if (assistant === "jornada") {
    if (await getFeatureFlag(FEATURE_FLAGS.BROKER_JOURNEY).catch(() => "false") !== "true") redirect("/dashboard");
    const [journey, dailySummaries] = await Promise.all([
      getCachedBrokerJourneyData(context.tenantId, context.userId).catch(() => null),
      getJourneyDailySummaries(context.tenantId, context.userId),
    ]);
    const unseen = journey?.celebrations.map((item) => item.id) ?? [];
    return (
      <>
        <AssistantChat identity={identity} script={buildJourneyScript({ journey, dailySummaries, now: new Date() })} />
        {unseen.length ? <MarkSeenOnView kind="jornada" ids={unseen} /> : null}
      </>
    );
  }
  // Cotação and Insights have their own screens.
  if (!SCRIPTED.includes(assistant as Scripted)) redirect(definition.href);
  const data = await getBrokerWorkspaceData();
  const script = buildAssistantScript(assistant as Scripted, { data, now: new Date() });
  // Leads: one tap to the full list with filters (same place as "Ver meus leads" in Desempenho).
  const headerAction = assistant === "leads"
    ? (
      <Link href="/minha-fila" className={chatStyles.headerPill}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        Ver todos
      </Link>
    )
    : undefined;
  return <AssistantChat identity={identity} script={script} headerAction={headerAction} agentId={assistant as Scripted} />;
}
