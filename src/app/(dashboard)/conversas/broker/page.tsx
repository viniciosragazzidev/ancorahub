import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";

import { LightConversationsView, type BrokerConversationInsight, type BrokerInsightMessage } from "@/features/broker-workspace/components/light-conversations-view";
import { ConnectionBadge } from "@/features/broker-workspace/components/connection-badge";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { hasPermission } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { DashboardHeader } from "@/components/dashboard-header";

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

function readIntelligence(value: unknown) {
  const details = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const assessment = details.aiIntelligence && typeof details.aiIntelligence === "object"
    ? details.aiIntelligence as Record<string, unknown>
    : {};
  const read = (key: string) => typeof assessment[key] === "string" ? assessment[key] : null;
  return {
    summary: read("summary"),
    nextBestAction: read("nextBestAction"),
    pendingFrom: read("pendingFrom"),
    sentiment: read("sentiment"),
    customerIntent: read("customerIntent"),
    risk: read("risk"),
    lastAnalyzedAt: typeof details.aiLastAnalyzedAt === "string" ? details.aiLastAnalyzedAt : null,
  };
}

/**
 * Corretor Lite: a conexão WAHA é um espelho operacional read-only.
 * A resposta ocorre no WhatsApp do corretor; esta rota só revela a própria
 * carteira e os insights já persistidos pelo CRM.
 */
export default async function BrokerConversationsPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const { leadId } = await searchParams;
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "acessar_conversas")) redirect("/minha-fila");
  if (context.role !== "broker" || (await getExperienceMode(context)) !== "LIGHT") redirect("/conversas");
  if ((await getSystemSetting("feature_waha_connections_enabled")) === "false") redirect("/minha-fila");

  const db = getDatabase();
  const [leads, clients, connectionRows] = await Promise.all([
    db.select({ id: schema.leads.id, nome: schema.leads.nome, telefone: schema.leads.telefone, status: schema.leads.status, firstContactAt: schema.leads.firstContactAt, serviceStartedAt: schema.leads.serviceStartedAt, stageEnteredAt: schema.leads.stageEnteredAt, qualificationDetails: schema.leads.qualificationDetails })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), isNull(schema.leads.deletedAt)))
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
  const messageRows = leadIds.length || clientIds.length
    ? await db.select({ id: schema.whatsappMessages.id, leadId: schema.whatsappMessages.leadId, clientId: schema.whatsappMessages.clientId, body: schema.whatsappMessages.body, direction: schema.whatsappMessages.direction, providerStatus: schema.whatsappMessages.providerStatus, sentAt: schema.whatsappMessages.sentAt })
      .from(schema.whatsappMessages)
      .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), or(...(leadIds.length ? [inArray(schema.whatsappMessages.leadId, leadIds)] : []), ...(clientIds.length ? [inArray(schema.whatsappMessages.clientId, clientIds)] : []))))
      .orderBy(desc(schema.whatsappMessages.sentAt)).limit(1_000)
    : [];

  const byLead = new Map<string, BrokerInsightMessage[]>();
  const byClient = new Map<string, BrokerInsightMessage[]>();
  for (const message of messageRows) {
    const mapped = { id: message.id, body: message.body, direction: message.direction, sentAt: toIso(message.sentAt) ?? new Date().toISOString(), providerStatus: message.providerStatus };
    if (message.leadId) byLead.set(message.leadId, [...(byLead.get(message.leadId) ?? []), mapped]);
    if (message.clientId) byClient.set(message.clientId, [...(byClient.get(message.clientId) ?? []), mapped]);
  }

  const insights: BrokerConversationInsight[] = [
    ...leads.map((lead) => {
      const messages = (byLead.get(lead.id) ?? []).sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)).slice(-100);
      return { id: lead.id, kind: "lead" as const, name: lead.nome, phone: lead.telefone, status: lead.status, href: `/leads/${lead.id}`, firstContactAt: toIso(lead.firstContactAt), serviceStartedAt: toIso(lead.serviceStartedAt), latestMessage: messages.at(-1) ?? null, messages, intelligence: readIntelligence(lead.qualificationDetails) };
    }),
    ...clients.map((client) => {
      const messages = (byClient.get(client.id) ?? []).sort((a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt)).slice(-100);
      return { id: `client:${client.id}`, kind: "client" as const, name: client.nome, phone: client.telefone, status: "Cliente", href: client.leadId ? `/leads/${client.leadId}` : "/clientes", latestMessage: messages.at(-1) ?? null, messages, intelligence: null };
    }),
  ].sort((a, b) => toTimestamp(b.latestMessage?.sentAt) - toTimestamp(a.latestMessage?.sentAt));

  const connection = connectionRows[0];
  return (
    <>
      <DashboardHeader
        breadcrumb="Comunicação"
        title="Conversas"
        rightSlot={
          <ConnectionBadge
            connected={connection?.status === "ready"}
            status={connection?.status ?? "disconnected"}
          />
        }
      />
      <main className="flex h-[calc(100dvh-var(--header-height))] min-h-0 w-full flex-col overflow-hidden bg-background">
        <LightConversationsView
          insights={insights}
          initialLeadId={leadId}
          whatsappConnected={connection?.status === "ready"}
          connectionStatus={connection?.status ?? "disconnected"}
        />
      </main>
    </>
  );
}
