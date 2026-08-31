import { redirect } from "next/navigation";
import { desc, eq, and, isNull } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { LightConversationsView } from "@/features/broker-workspace/components/light-conversations-view";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { buildOfficialTenantConversations } from "@/features/broker-workspace/official-tenant-conversations";
import { samePhone } from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasPermission } from "@/shared/auth/permissions";
import { getSystemSetting } from "@/features/system-settings/queries";

// Não gerar estaticamente — a página depende de sessão
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rota do corretor (modo lite) — usa WAHA para WhatsApp.
 * Apenas corretores podem acessar. Diretores/gestores vão para /conversas.
 */
export default async function BrokerConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; draft?: string }>;
}) {
  const { leadId, draft } = await searchParams;
  const context = await getRequiredTenantContext();

  if (!hasPermission(context.role, "acessar_conversas")) {
    redirect("/minha-fila");
  }

  // A superfície WAHA Lite é exclusiva do papel Corretor com o modo Lite ativo.
  // Diretores, gestores e corretores no modo normal usam a central geral.
  if (context.role !== "broker" || (await getExperienceMode(context)) !== "LIGHT") {
    redirect("/conversas");
  }

  // Pausa global reversível: não desconecta nem exclui a sessão do corretor,
  // apenas bloqueia a superfície interna até a reativação pelo Super-admin.
  if ((await getSystemSetting("feature_waha_connections_enabled")) === "false") {
    redirect("/minha-fila");
  }

  const db = getDatabase();

  // These queries are isolated by the authenticated tenant/user context and
  // do not depend on one another. Run them concurrently so the workspace can
  // start rendering as soon as the slowest authorized read completes.
  const lightLeadsPromise = db
    .select({
      id: schema.leads.id,
      nome: schema.leads.nome,
      telefone: schema.leads.telefone,
      status: schema.leads.status,
      createdAt: schema.leads.createdAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
        eq(schema.leads.corretorId, context.userId),
      ),
    )
    .orderBy(desc(schema.leads.stageEnteredAt))
    .limit(100);
  const lightClientsPromise = db
    .select({
      id: schema.clients.id,
      leadId: schema.clients.leadId,
      nome: schema.clients.nome,
      telefone: schema.clients.telefone,
    })
    .from(schema.clients)
    .where(
      and(
        eq(schema.clients.tenantId, context.tenantId),
        eq(schema.clients.corretorId, context.userId),
      ),
    )
    .limit(100);
  const tenantNumbersPromise = db
    .select({
      id: schema.wahaNumbers.id,
      label: schema.wahaNumbers.label,
      phone: schema.wahaNumbers.displayPhoneNumber,
    })
    .from(schema.wahaNumbers)
    .where(eq(schema.wahaNumbers.tenantId, context.tenantId));
  const tenantChannelsPromise = db
    .select({
      id: schema.communicationChannels.id,
      name: schema.communicationChannels.verifiedName,
      phone: schema.communicationChannels.displayPhoneNumber,
    })
    .from(schema.communicationChannels)
    .where(
      and(
        eq(schema.communicationChannels.tenantId, context.tenantId),
        eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
        eq(schema.communicationChannels.status, "active"),
      ),
    );
  const messageRowsPromise = db
    .select({
      id: schema.whatsappMessages.id,
      leadId: schema.whatsappMessages.leadId,
      clientId: schema.whatsappMessages.clientId,
      phone: schema.whatsappMessages.phone,
      body: schema.whatsappMessages.body,
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      providerStatus: schema.whatsappMessages.providerStatus,
      sentAt: schema.whatsappMessages.sentAt,
    })
    .from(schema.whatsappMessages)
    .where(eq(schema.whatsappMessages.tenantId, context.tenantId))
    .orderBy(desc(schema.whatsappMessages.sentAt))
    .limit(500);
  const connectionPromise = db
    .select({
      sessionName: schema.whatsappConnections.sessionName,
      status: schema.whatsappConnections.status,
      chatInternoAtivo: schema.whatsappConnections.chatInternoAtivo,
    })
    .from(schema.whatsappConnections)
    .where(
      and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.userId, context.userId),
      ),
    )
    .limit(1);
  const officialOutboundPromise = db
    .select({
      id: schema.whatsappOutboundMessages.id,
      purpose: schema.whatsappOutboundMessages.purpose,
      messageType: schema.whatsappOutboundMessages.messageType,
      templateName: schema.whatsappOutboundMessages.templateName,
      variables: schema.whatsappOutboundMessages.variables,
      status: schema.whatsappOutboundMessages.status,
      createdAt: schema.whatsappOutboundMessages.createdAt,
      sentAt: schema.whatsappOutboundMessages.sentAt,
      deliveredAt: schema.whatsappOutboundMessages.deliveredAt,
      readAt: schema.whatsappOutboundMessages.readAt,
      channelId: schema.whatsappOutboundMessages.channelId,
      destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
    })
    .from(schema.whatsappOutboundMessages)
    .where(
      and(
        eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
        eq(schema.whatsappOutboundMessages.recipientType, "user"),
        eq(schema.whatsappOutboundMessages.recipientId, context.userId),
      ),
    )
    .orderBy(desc(schema.whatsappOutboundMessages.createdAt))
    .limit(100);

  const [lightLeads, lightClients, tenantNumbers, tenantChannels, messageRows, connectionRows, draftTemplate, officialOutbounds] = await Promise.all([
    lightLeadsPromise,
    lightClientsPromise,
    tenantNumbersPromise,
    tenantChannelsPromise,
    messageRowsPromise,
    connectionPromise,
    draftTemplatePromise,
    officialOutboundPromise,
  ]);

  const selectedLead = leadId ? lightLeads.find((lead) => lead.id === leadId) : null;
  const initialDraft =
    draft === "broker_intro" && selectedLead
      ? (
          draftTemplate?.trim() ||
          "Olá, {nome}! Sou seu corretor e vou seguir com seu atendimento por aqui."
        ).replaceAll("{nome}", selectedLead.nome.split(" ")[0] || selectedLead.nome)
      : undefined;
  const messagesByLead = new Map<string, typeof messageRows>();
  for (const msg of messageRows) {
    const matched = lightLeads.find(
      (l) =>
        l.id === msg.leadId ||
        (Boolean(msg.phone && l.telefone) && samePhone(msg.phone, l.telefone)),
    );
    if (matched) {
      const list = messagesByLead.get(matched.id) ?? [];
      list.push(msg);
      messagesByLead.set(matched.id, list);
    }
  }

  // ── Montar conversas ──────────────────────────────────────────────────
  const conversations = lightLeads.map((lead) => {
    const msgs = (messagesByLead.get(lead.id) ?? [])
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .slice(-100);
    const latest = msgs.at(-1) ?? null;
    return {
      id: lead.id,
      kind: "lead" as const,
      sendTarget: { kind: "lead" as const, leadId: lead.id },
      nome: lead.nome,
      telefone: lead.telefone,
      status: lead.status,
      latestMessage: latest
        ? {
            body: latest.body,
            direction: latest.direction,
            sentAt: latest.sentAt.toISOString(),
          }
        : null,
      messages: msgs.map((m) => ({
        id: m.id,
        body: m.body,
        direction: m.direction,
        sentAt: m.sentAt.toISOString(),
        senderRole: m.senderRole,
        providerStatus: m.providerStatus,
      })),
    };
  });

  const clientConversations = lightClients.map((client) => {
    const msgs = messageRows
      .filter(
        (message) =>
          message.clientId === client.id ||
          message.leadId === client.leadId ||
          samePhone(message.phone, client.telefone),
      )
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
      .slice(-100);
    const latest = msgs.at(-1) ?? null;
    return {
      id: `client:${client.id}`,
      kind: "client" as const,
      sendTarget: { kind: "lead" as const, leadId: client.leadId },
      nome: client.nome,
      telefone: client.telefone,
      status: "Cliente",
      latestMessage: latest
        ? { body: latest.body, direction: latest.direction, sentAt: latest.sentAt.toISOString() }
        : null,
      messages: msgs.map((message) => ({
        id: message.id,
        body: message.body,
        direction: message.direction,
        sentAt: message.sentAt.toISOString(),
        senderRole: message.senderRole,
        providerStatus: message.providerStatus,
      })),
    };
  });

  const officialConversations = buildOfficialTenantConversations(
    [
      ...tenantNumbers.map((number) => ({
        id: number.id,
        source: "number" as const,
        name: number.label || "Número oficial do tenant",
        phone: number.phone,
      })),
      ...tenantChannels
        .filter((channel) => Boolean(channel.phone))
        .map((channel) => ({
          id: channel.id,
          source: "channel" as const,
          name: channel.name || "Número oficial do tenant",
          phone: channel.phone!,
        })),
    ],
    messageRows
      .filter((message) => !message.leadId && !message.clientId)
      .map((message) => ({
        id: message.id,
        body: message.body,
        direction: message.direction,
        sentAt: message.sentAt.toISOString(),
        phone: message.phone,
        senderRole: message.senderRole,
        providerStatus: message.providerStatus,
      })),
    officialOutbounds,
  );

  // Sort: conversas com mensagens recentes primeiro
  const scopedConversations = [...conversations, ...clientConversations, ...officialConversations];
  scopedConversations.sort((a, b) => {
    const timeA = a.latestMessage ? new Date(a.latestMessage.sentAt).getTime() : 0;
    const timeB = b.latestMessage ? new Date(b.latestMessage.sentAt).getTime() : 0;
    return timeB - timeA;
  });

  // ── Status WhatsApp do corretor ───────────────────────────────────────
  const [conn] = connectionRows;

  const whatsappConnected = conn?.status === "ready" && conn?.chatInternoAtivo === true;

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Conversas" />
      <main className="min-h-0 w-full flex-1 bg-background p-0">
        <div className="h-full min-h-[calc(100dvh-var(--header-height,3.5rem))] max-[559px]:min-h-0 w-full overflow-hidden bg-card">
          <LightConversationsView
            conversations={scopedConversations}
            initialLeadId={leadId}
            initialDraft={initialDraft}
            whatsappConnected={whatsappConnected}
          />
        </div>
      </main>
    </>
  );
}
