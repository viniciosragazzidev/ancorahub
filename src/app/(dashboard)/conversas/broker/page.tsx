import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { RefreshSoon } from "@/components/chat/refresh-soon";
import { requestLeadConversationAnalysis } from "@/features/conversation-intelligence/trigger";

import { LightConversationsView, type BrokerConversationInsight, type BrokerInsightMessage } from "@/features/broker-workspace/components/light-conversations-view";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { hasPermission } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";
import { getSystemSetting } from "@/features/system-settings/queries";
import { AssistantChat } from "@/components/chat/assistant-chat";
import { ASSISTANTS } from "@/features/broker-workspace/chat/assistant-scripts";
import { buildInsightThreads, buildInsightsScript, buildLeadInsightScript, isWaitingForBroker } from "@/features/broker-workspace/chat/insights-script";
import { ThreadListScreen } from "@/components/chat/thread-list-screen";
import { readLeadIntelligence as readIntelligence } from "@/features/broker-workspace/chat/intelligence";
import { canRevealLightContact } from "@/features/broker-workspace/lead-contact-privacy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toTimestamp(value: Date | string | null | undefined) {
  const iso = toIso(value);
  return iso ? Date.parse(iso) : 0;
}

/**
 * Corretor Lite: a conexão WAHA é um espelho operacional read-only.
 * A resposta ocorre no WhatsApp do corretor; esta rota só revela a própria
 * carteira e os insights já persistidos pelo CRM.
 */
export default async function BrokerConversationsPage({ searchParams }: { searchParams: Promise<{ leadId?: string; todas?: string; insight?: string }> }) {
  const { leadId, todas, insight } = await searchParams;
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "acessar_conversas")) redirect("/minha-fila");
  if (context.role !== "broker" || (await getExperienceMode(context)) !== "LIGHT") redirect("/conversas");
  if ((await getSystemSetting("feature_waha_connections_enabled")) === "false") redirect("/minha-fila");

  const db = getDatabase();
  const [leads, clients, connectionRows] = await Promise.all([
    db.select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone, status: schema.leads.status, firstContactAt: schema.leads.firstContactAt, serviceStartedAt: schema.leads.serviceStartedAt, stageEnteredAt: schema.leads.stageEnteredAt, qualificationDetails: schema.leads.qualificationDetails })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt)))
      .orderBy(desc(schema.leads.stageEnteredAt)).limit(150),
    db.select({ id: schema.clients.id, leadId: schema.clients.leadId, nome: schema.clients.nome, telefone: schema.clients.telefone, createdAt: schema.clients.createdAt })
      .from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), eq(schema.clients.corretorId, context.userId))).limit(150),
    db.select({ status: schema.whatsappConnections.status, chatInternoAtivo: schema.whatsappConnections.chatInternoAtivo })
      .from(schema.whatsappConnections)
      .where(and(eq(schema.whatsappConnections.tenantId, context.tenantId), eq(schema.whatsappConnections.userId, context.userId))).limit(1),
  ]);

  const leadIds = leads.map((lead) => lead.id);
  const clientIds = clients.map((client) => client.id);
  const requestedConversationId = leadId && todas !== "1" && !insight ? leadId : null;
  const selectedLeadId = requestedConversationId
    ? leads.find((lead) => lead.id === requestedConversationId)?.id
    : undefined;
  const requestedClientId = requestedConversationId?.startsWith("client:")
    ? requestedConversationId.slice("client:".length)
    : null;
  const selectedClientId = requestedClientId
    ? clients.find((client) => client.id === requestedClientId)?.id
    : undefined;
  const messageFields = {
    id: schema.whatsappMessages.id,
    leadId: schema.whatsappMessages.leadId,
    clientId: schema.whatsappMessages.clientId,
    body: schema.whatsappMessages.body,
    direction: schema.whatsappMessages.direction,
    providerStatus: schema.whatsappMessages.providerStatus,
    sentAt: schema.whatsappMessages.sentAt,
  };
  // Same guard as /conversas: stories and contentless "[text]" events are not messages.
  const visibleMessage = and(
    notStatusBroadcastSql(schema.whatsappMessages.messageId),
    sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`,
  );
  const latestLeadMessagesPromise = leadIds.length
    ? db.selectDistinctOn([schema.whatsappMessages.leadId], messageFields)
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), inArray(schema.whatsappMessages.leadId, leadIds), visibleMessage))
      .orderBy(schema.whatsappMessages.leadId, desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
    : Promise.resolve([]);
  const latestClientMessagesPromise = clientIds.length
    ? db.selectDistinctOn([schema.whatsappMessages.clientId], messageFields)
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), inArray(schema.whatsappMessages.clientId, clientIds), visibleMessage))
      .orderBy(schema.whatsappMessages.clientId, desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
    : Promise.resolve([]);
  const selectedMessagesPromise = selectedLeadId
    ? db.select(messageFields)
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, selectedLeadId), visibleMessage))
      .orderBy(desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
      .limit(30)
    : selectedClientId
      ? db.select(messageFields)
        .from(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.clientId, selectedClientId), visibleMessage))
        .orderBy(desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
        .limit(30)
      : Promise.resolve([]);
  const [latestLeadMessages, latestClientMessages, selectedMessages] = await Promise.all([
    latestLeadMessagesPromise,
    latestClientMessagesPromise,
    selectedMessagesPromise,
  ]);

  const byLead = new Map<string, BrokerInsightMessage[]>();
  const byClient = new Map<string, BrokerInsightMessage[]>();
  const mapMessage = (message: (typeof latestLeadMessages)[number]): BrokerInsightMessage => ({
    id: message.id,
    body: message.body,
    direction: message.direction,
    sentAt: toIso(message.sentAt) ?? new Date().toISOString(),
    providerStatus: message.providerStatus,
  });
  for (const message of latestLeadMessages) {
    if (message.leadId) byLead.set(message.leadId, [mapMessage(message)]);
  }
  for (const message of latestClientMessages) {
    if (message.clientId) byClient.set(message.clientId, [mapMessage(message)]);
  }
  const selectedHistory = selectedMessages.map(mapMessage).reverse();
  if (selectedLeadId) byLead.set(selectedLeadId, selectedHistory);
  if (selectedClientId) byClient.set(selectedClientId, selectedHistory);

  const insights: BrokerConversationInsight[] = [
    ...leads.map((lead) => {
      const messages = byLead.get(lead.id) ?? [];
      return { id: lead.id, kind: "lead" as const, name: lead.nome, phone: canRevealLightContact({ status: lead.status, isCurrentBroker: true }) ? lead.telefone : null, status: lead.status, href: `/leads/${lead.id}`, firstContactAt: toIso(lead.firstContactAt), serviceStartedAt: toIso(lead.serviceStartedAt), latestMessage: messages.at(-1) ?? null, messages, intelligence: readIntelligence(lead.qualificationDetails) };
    }),
    ...clients.map((client) => {
      const messages = byClient.get(client.id) ?? [];
      return { id: `client:${client.id}`, kind: "client" as const, name: client.nome, phone: client.telefone, status: "Cliente", href: client.leadId ? `/leads/${client.leadId}` : "/clientes", latestMessage: messages.at(-1) ?? null, messages, intelligence: null };
    }),
  ]
    // A conversa só existe depois da primeira mensagem sincronizada. Leads
    // atribuídos sem mensagem continuam disponíveis na fila, não nesta central.
    .filter((item) => item.messages.length > 0)
    .sort((a, b) => toTimestamp(b.latestMessage?.sentAt) - toTimestamp(a.latestMessage?.sentAt));

  const connection = connectionRows[0];
  // On demand (2026-10-12): a lead conversation without an analysis, or with messages newer
  // than it, is read now in the background (at most once per 15 min per lead).
  const needsAnalysis = (item: (typeof insights)[number]) => item.kind === "lead"
    && (!item.intelligence?.lastAnalyzedAt || toTimestamp(item.latestMessage?.sentAt) > toTimestamp(item.intelligence.lastAnalyzedAt));
  const analyze = (items: (typeof insights)) => {
    const ids = items.filter(needsAnalysis).slice(0, 3).map((item) => item.id);
    if (ids.length) after(async () => { for (const id of ids) await requestLeadConversationAnalysis(id, context.tenantId, context.userId); });
    return ids.length > 0;
  };
  // One conversation's analysis: insights and next step, not the transcript.
  const insightItem = insight ? insights.find((item) => item.id === insight) : null;
  if (insightItem) {
    const insightsAssistant = ASSISTANTS.insights;
    const analyzing = analyze([insightItem]);
    return (
      <>
        {/* A key per screen: the list and each analysis share the URL path, so the chat must restart (it kept the previous lead). */}
        <AssistantChat
          key={`insight-${insightItem.id}`}
          identity={{ name: `Análise · ${insightItem.name.split(" ")[0]}`, shape: insightsAssistant.shape, hue: insightsAssistant.hue }}
          script={buildLeadInsightScript({ item: insightItem, now: new Date(), analyzing })}
          agentId="insights"
        />
        {analyzing ? <RefreshSoon times={1} /> : null}
      </>
    );
  }
  // Broker chat (2026-10-09): Insights opens with who is waiting for an answer; the mirror stays one tap away.
  if (!leadId && todas !== "1") {
    const insightsAssistant = ASSISTANTS.insights;
    // The ones waiting for the broker first: their tips matter now.
    const analyzing = analyze(insights.filter(isWaitingForBroker));
    return (
      <>
        <AssistantChat
          key="insights-home"
          identity={{ name: insightsAssistant.name, shape: insightsAssistant.shape, hue: insightsAssistant.hue }}
          script={buildInsightsScript({ insights, whatsappConnected: connection?.status === "ready", now: new Date() })}
          agentId="insights"
        />
        {analyzing ? <RefreshSoon times={1} afterMs={12_000} /> : null}
      </>
    );
  }
  // All conversations: the same chat rows as the Início; each opens the lead's chat.
  if (todas === "1") {
    const threads = buildInsightThreads(insights);
    const waiting = threads.filter((thread) => thread.waitingYou).length;
    return (
      <div className="arc-venancor">
        <ThreadListScreen
          title="Conversas"
          subtitle={waiting ? `${waiting} esperando sua resposta` : "Ninguém esperando você"}
          backHref="/conversas/broker"
          threads={threads}
          nowIso={new Date().toISOString()}
          emptyText={connection?.status === "ready" ? "Nenhuma conversa ainda." : "Conecte seu WhatsApp para ver suas conversas aqui."}
        />
      </div>
    );
  }
  return (
    <LightConversationsView
      insights={insights}
      initialLeadId={leadId}
      whatsappConnected={connection?.status === "ready"}
      connectionStatus={connection?.status ?? "disconnected"}
    />
  );
}
