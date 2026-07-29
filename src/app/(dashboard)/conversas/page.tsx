import Link from "next/link";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationsWorkspace, type ConversationItem, type ConversationMessage } from "./conversations-workspace";
import { OfficialBrokerConversations, type OfficialBrokerConversation, type OfficialBrokerMessage } from "./official-broker-conversations";
import { isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// Não gerar estaticamente — a página depende de sessão e executa queries pesadas de AI
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ leadId?: string; tab?: string }> }) {
  const { leadId, tab } = await searchParams;
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const isDirector = context.role === "director";
  const officialBrokerTab = isDirector && tab === "corretores";
  const scope = context.role === "broker"
    ? eq(schema.leads.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : undefined;

  const [leads, branches] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
        origem: schema.leads.origem,
        branchId: schema.leads.branchId,
        corretorId: schema.leads.corretorId,
        corretorNome: schema.user.name,
        branchName: schema.branches.name,
        consentimentoLgpd: schema.leads.consentimentoLgpd,
        createdAt: schema.leads.createdAt,
        stageEnteredAt: schema.leads.stageEnteredAt,
        planName: schema.carrierPlans.name,
        carrierName: schema.carriers.name,
      })
      .from(schema.leads)
      .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
      .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNotNull(schema.leads.serviceStartedAt), ...(scope ? [scope] : [])))
      .orderBy(desc(schema.leads.stageEnteredAt))
      .limit(100),
    isDirector
      ? db
          .select({ id: schema.branches.id, name: schema.branches.name })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
          .orderBy(asc(schema.branches.name))
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const leadIds = leads.map((lead) => lead.id);

  const messagesSubquery = leadIds.length
    ? db
        .select({
          id: schema.whatsappMessages.id,
          leadId: schema.whatsappMessages.leadId,
          body: schema.whatsappMessages.body,
          direction: schema.whatsappMessages.direction,
          sentAt: schema.whatsappMessages.sentAt,
          rn: sql<number>`row_number() over (partition by ${schema.whatsappMessages.leadId} order by ${schema.whatsappMessages.sentAt} desc)`.as("rn")
        })
        .from(schema.whatsappMessages)
        .where(
          and(
            eq(schema.whatsappMessages.tenantId, context.tenantId),
            inArray(schema.whatsappMessages.leadId, leadIds)
          )
        )
        .as("msg_sq")
    : null;

  const [messageRows, documentRows, aiConversationRows] = leadIds.length && messagesSubquery
    ? await Promise.all([
      db
        .select({
          id: messagesSubquery.id,
          leadId: messagesSubquery.leadId,
          body: messagesSubquery.body,
          direction: messagesSubquery.direction,
          sentAt: messagesSubquery.sentAt
        })
        .from(messagesSubquery)
        .where(lt(messagesSubquery.rn, 21))
        .orderBy(messagesSubquery.sentAt),
      db
        .select({ id: schema.leadDocuments.id, leadId: schema.leadDocuments.leadId, filename: schema.leadDocuments.filename, fileUrl: schema.leadDocuments.fileUrl, status: schema.leadDocuments.status, requirementName: schema.documentRequirements.name, createdAt: schema.leadDocuments.createdAt })
        .from(schema.leadDocuments)
        .leftJoin(schema.documentRequirements, eq(schema.leadDocuments.requirementId, schema.documentRequirements.id))
        .where(and(eq(schema.leadDocuments.tenantId, context.tenantId), inArray(schema.leadDocuments.leadId, leadIds)))
        .orderBy(desc(schema.leadDocuments.createdAt)),
      db
        .select({
          id: schema.aiConversations.id,
          leadId: schema.aiConversations.leadId,
          status: schema.aiConversations.status,
          aiModel: schema.aiConversations.aiModel,
          transferReason: schema.aiConversations.transferReason,
          qualificationSummary: schema.aiConversations.qualificationSummary,
          assignedUserId: schema.aiConversations.assignedUserId,
        })
        .from(schema.aiConversations)
        .where(and(eq(schema.aiConversations.tenantId, context.tenantId), inArray(schema.aiConversations.leadId, leadIds)))
        .catch(() => []),
    ])
    : [[], [], []] as const;

  const messagesByLead = new Map<string, ConversationMessage[]>();
  for (const message of messageRows) {
    if (!message.leadId) continue;
    const items = messagesByLead.get(message.leadId) ?? [];
    items.push({ ...message, sentAt: message.sentAt.toISOString() });
    messagesByLead.set(message.leadId, items);
  }

  const documentsByLead = new Map<string, { id: string; filename: string; fileUrl: string; status: string; requirementName: string | null; createdAt: string }[]>();
  for (const document of documentRows) {
    const items = documentsByLead.get(document.leadId) ?? [];
    items.push({ ...document, createdAt: document.createdAt.toISOString() });
    documentsByLead.set(document.leadId, items);
  }

  const aiConversationsByLead = new Map<string, typeof aiConversationRows[number]>();
  for (const aiConv of aiConversationRows) {
    if (aiConv.leadId) {
      aiConversationsByLead.set(aiConv.leadId, aiConv);
    }
  }

  const conversations: ConversationItem[] = leads.map((lead) => {
    const messages = messagesByLead.get(lead.id) ?? [];
    const latest = messages.at(-1) ?? null;
    const aiConv = aiConversationsByLead.get(lead.id) ?? null;
    return {
      ...lead,
      createdAt: lead.createdAt.toISOString(),
      stageEnteredAt: lead.stageEnteredAt.toISOString(),
      latestMessage: latest ? { body: latest.body, direction: latest.direction, sentAt: latest.sentAt } : null,
      messages,
      documents: documentsByLead.get(lead.id) ?? [],
      aiConversation: aiConv
        ? {
            id: aiConv.id,
            status: aiConv.status as any,
            aiModel: aiConv.aiModel,
            transferReason: aiConv.transferReason,
            qualificationSummary: aiConv.qualificationSummary,
            assignedUserId: aiConv.assignedUserId,
          }
        : null,
    };
  });

  let officialBrokerConversations: OfficialBrokerConversation[] = [];
  const officialBrokerMessagesEnabled = officialBrokerTab ? await isMetaCloudWhatsAppEnabled() : false;
  if (officialBrokerTab && officialBrokerMessagesEnabled) {
    const [brokers, invitations, outboundMessages, inboundMessages] = await Promise.all([
      db.select({ id: schema.brokerProfiles.id, name: schema.brokerProfiles.professionalName, phone: schema.brokerProfiles.phone, branchName: schema.branches.name })
        .from(schema.brokerProfiles)
        .leftJoin(schema.branches, and(eq(schema.brokerProfiles.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
        .where(eq(schema.brokerProfiles.tenantId, context.tenantId))
        .orderBy(asc(schema.brokerProfiles.professionalName)),
      db.select({ brokerProfileId: schema.brokerInvitations.brokerProfileId, status: schema.brokerInvitations.status, deliveryStatus: schema.brokerInvitations.deliveryStatus, createdAt: schema.brokerInvitations.createdAt })
        .from(schema.brokerInvitations)
        .where(eq(schema.brokerInvitations.tenantId, context.tenantId))
        .orderBy(desc(schema.brokerInvitations.createdAt)),
      db.select({ id: schema.whatsappOutboundMessages.id, destinationPhone: schema.whatsappOutboundMessages.destinationPhone, purpose: schema.whatsappOutboundMessages.purpose, messageType: schema.whatsappOutboundMessages.messageType, templateName: schema.whatsappOutboundMessages.templateName, status: schema.whatsappOutboundMessages.status, createdAt: schema.whatsappOutboundMessages.createdAt, sentAt: schema.whatsappOutboundMessages.sentAt, deliveredAt: schema.whatsappOutboundMessages.deliveredAt, readAt: schema.whatsappOutboundMessages.readAt, attempts: schema.whatsappOutboundMessages.attempts, providerErrorMessage: schema.whatsappOutboundMessages.providerErrorMessage })
        .from(schema.whatsappOutboundMessages)
        .innerJoin(schema.communicationChannels, and(eq(schema.whatsappOutboundMessages.channelId, schema.communicationChannels.id), eq(schema.communicationChannels.tenantId, context.tenantId)))
        .where(and(eq(schema.whatsappOutboundMessages.tenantId, context.tenantId), eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.whatsappOutboundMessages.recipientType, "user")))
        .orderBy(desc(schema.whatsappOutboundMessages.createdAt))
        .limit(500),
      db.select({ id: schema.whatsappMessages.id, phone: schema.whatsappMessages.phone, body: schema.whatsappMessages.body, providerStatus: schema.whatsappMessages.providerStatus, sentAt: schema.whatsappMessages.sentAt })
        .from(schema.whatsappMessages)
        .where(and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.provider, META_CLOUD_PROVIDER), eq(schema.whatsappMessages.direction, "incoming"), isNull(schema.whatsappMessages.leadId)))
        .orderBy(desc(schema.whatsappMessages.sentAt))
        .limit(500),
    ]);

    const brokerByPhone = new Map(brokers.map((broker) => [normalizePhone(broker.phone), broker]));
    const invitationByBroker = new Map<string, (typeof invitations)[number]>();
    for (const invitation of invitations) if (!invitationByBroker.has(invitation.brokerProfileId)) invitationByBroker.set(invitation.brokerProfileId, invitation);
    const messagesByBroker = new Map<string, OfficialBrokerMessage[]>();
    const addMessage = (brokerId: string, message: OfficialBrokerMessage) => messagesByBroker.set(brokerId, [...(messagesByBroker.get(brokerId) ?? []), message]);

    for (const message of outboundMessages) {
      const broker = brokerByPhone.get(normalizePhone(message.destinationPhone));
      if (!broker) continue;
      addMessage(broker.id, {
        id: `out:${message.id}`,
        direction: "outgoing",
        body: describeOfficialOutbound(message.purpose, message.messageType, message.templateName),
        sentAt: (message.readAt ?? message.deliveredAt ?? message.sentAt ?? message.createdAt).toISOString(),
        status: normalizeOutboundStatus(message.status),
        purpose: message.purpose,
        templateName: message.templateName === "__text__" ? undefined : message.templateName,
        attempts: message.attempts,
        error: message.status === "failed" ? "A Meta não confirmou a entrega. Consulte o status do canal e reenvie pelo fluxo de equipe." : null,
      });
    }
    for (const message of inboundMessages) {
      const broker = brokerByPhone.get(normalizePhone(message.phone));
      if (!broker) continue;
      addMessage(broker.id, { id: `in:${message.id}`, direction: "incoming", body: message.body || "[Mensagem sem texto]", sentAt: message.sentAt.toISOString(), status: "received" });
    }

    officialBrokerConversations = brokers.map((broker) => {
      const invitation = invitationByBroker.get(broker.id);
      return {
        brokerProfileId: broker.id,
        name: broker.name,
        phoneMasked: maskPhone(broker.phone),
        branchName: broker.branchName,
        invitationStatus: invitation?.status ?? null,
        invitationDeliveryStatus: invitation?.deliveryStatus ?? null,
        messages: (messagesByBroker.get(broker.id) ?? []).sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime()),
      };
    }).filter((conversation) => conversation.messages.length > 0 || Boolean(conversation.invitationStatus));

    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "official_broker_conversations", entidadeId: context.tenantId, acao: "consultou_historico" });
  }

  return (
    <>
      <DashboardHeader breadcrumb="Atendimento" title="Conversas" />
      <main className="min-w-0 min-h-0 flex-1 bg-background p-3 lg:p-4">
        {isDirector ? <nav aria-label="Tipo de conversa" className="mb-3 flex items-center gap-1.5 border-b border-border px-1"><Button render={<Link href="/conversas" />} size="sm" variant={officialBrokerTab ? "ghost" : "secondary"}>Leads <Badge variant="outline">{conversations.length}</Badge></Button><Button render={<Link href="/conversas?tab=corretores" />} size="sm" variant={officialBrokerTab ? "secondary" : "ghost"}>Número oficial · corretores</Button></nav> : null}
        {officialBrokerTab ? <OfficialBrokerConversations enabled={officialBrokerMessagesEnabled} conversations={officialBrokerConversations} /> : <ConversationsWorkspace
          role={context.role}
          branches={branches}
          conversations={conversations}
          initialLeadId={leadId}
          userId={context.userId}
          tenantId={context.tenantId}
        />}
      </main>
    </>
  );
}

function normalizePhone(phone: string) { return phone.replace(/\D/g, ""); }
function maskPhone(phone: string) { const digits = normalizePhone(phone); return digits.length > 4 ? `+${digits.slice(0, Math.max(0, digits.length - 8))} ****-${digits.slice(-4)}` : "Número protegido"; }
function normalizeOutboundStatus(status: string): OfficialBrokerMessage["status"] { return ["pending", "queued", "sent", "delivered", "read", "failed"].includes(status) ? status as OfficialBrokerMessage["status"] : "queued"; }
function describeOfficialOutbound(purpose: string, messageType: string, templateName: string) {
  if (purpose === "brokerInvitation") return "Convite para criar o primeiro acesso no AncoraHub.";
  if (purpose === "newLeadAssignment") return "Oferta de novo lead enviada ao corretor.";
  if (purpose === "leadAssignmentConfirmed") return "Confirmação de lead atribuído enviada ao corretor.";
  if (messageType === "text") return "Mensagem de texto enviada pelo número oficial.";
  return `Modelo oficial enviado: ${templateName}.`;
}
