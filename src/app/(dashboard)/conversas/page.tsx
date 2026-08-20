import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConversationsWorkspace, type ConversationItem, type ConversationMessage } from "./conversations-workspace";
import { OfficialBrokerConversations, type OfficialBrokerConversation, type OfficialBrokerMessage } from "./official-broker-conversations";
import { LightConversationsView } from "@/features/broker-workspace/components/light-conversations-view";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { isMetaCloudWhatsAppEnabled, samePhone } from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { BulkQualificationDialog } from "@/features/ai-qualification/components/bulk-qualification-dialog";
import { hasPermission } from "@/shared/auth/permissions";

// Não gerar estaticamente — a página depende de sessão e executa queries pesadas de AI
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ leadId?: string; tab?: string }> }) {
  const { leadId, tab } = await searchParams;
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "acessar_conversas")) {
    redirect("/minha-fila");
  }
  const db = getDatabase();

  const isDirector = context.role === "director";
  const officialBrokerTab = isDirector && tab === "corretores";
  const scope = context.role === "manager" && context.branchId
    ? eq(schema.leads.branchId, context.branchId)
    : undefined;

  // ── Modo Lite (corretor) ──────────────────────────────────────────────
  // Renderiza uma versão simplificada: lista de conversas + chat direto.
  if ((await getExperienceMode(context)) === "LIGHT") {
    const lightLeads = await db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        status: schema.leads.status,
        createdAt: schema.leads.createdAt,
        stageEnteredAt: schema.leads.stageEnteredAt,
      })
      .from(schema.leads)
      .where(and(
        eq(schema.leads.tenantId, context.tenantId),
        isNull(schema.leads.deletedAt),
        eq(schema.leads.corretorId, context.userId),
      ))
      .orderBy(desc(schema.leads.stageEnteredAt))
      .limit(100);

    const leadIds = lightLeads.map((l) => l.id);
    const messageRows = leadIds.length
      ? await db
          .select({
            id: schema.whatsappMessages.id,
            leadId: schema.whatsappMessages.leadId,
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
          .limit(500)
      : [];

    const messagesByLead = new Map<string, typeof messageRows>();
    for (const msg of messageRows) {
      const matched = lightLeads.find(
        (l) => l.id === msg.leadId || (Boolean(msg.phone && l.telefone) && samePhone(msg.phone, l.telefone)),
      );
      if (matched) {
        const list = messagesByLead.get(matched.id) ?? [];
        list.push(msg);
        messagesByLead.set(matched.id, list);
      }
    }

    const conversations = lightLeads.map((lead) => {
      const msgs = (messagesByLead.get(lead.id) ?? [])
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
        .slice(-100);
      const latest = msgs.at(-1) ?? null;
      return {
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        status: lead.status,
        latestMessage: latest
          ? { body: latest.body, direction: latest.direction, sentAt: latest.sentAt.toISOString() }
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

    // Sort: conversations with recent messages first
    conversations.sort((a, b) => {
      const timeA = a.latestMessage ? new Date(a.latestMessage.sentAt).getTime() : 0;
      const timeB = b.latestMessage ? new Date(b.latestMessage.sentAt).getTime() : 0;
      return timeB - timeA;
    });

    // Check WhatsApp connection status for the broker
    const [conn] = await db
      .select({
        sessionName: schema.whatsappConnections.sessionName,
        status: schema.whatsappConnections.status,
        chatInternoAtivo: schema.whatsappConnections.chatInternoAtivo,
      })
      .from(schema.whatsappConnections)
      .where(and(
        eq(schema.whatsappConnections.tenantId, context.tenantId),
        eq(schema.whatsappConnections.userId, context.userId),
      ))
      .limit(1);

    const whatsappConnected = conn?.status === "ready" && conn?.chatInternoAtivo === true;

    return (
      <>
        <DashboardHeader breadcrumb="Atendimento" title="Conversas" />
        <main className="min-h-0 w-full flex-1 bg-background p-0">
          <div className="h-full min-h-[calc(100dvh-var(--header-height,3.5rem))] max-[559px]:min-h-0 w-full overflow-hidden bg-card">
            <LightConversationsView
              conversations={conversations}
              initialLeadId={leadId}
              whatsappConnected={whatsappConnected}
            />
          </div>
        </main>
      </>
    );
  }

  const [leads, branches] = await Promise.all([
    db
      .select({
        id: schema.leads.id,
        nome: schema.leads.nome,
        telefone: schema.leads.telefone,
        email: schema.leads.email,
        status: schema.leads.status,
        qualificationStatus: schema.leads.qualificationStatus,
        origem: schema.leads.origem,
        branchId: schema.leads.branchId,
        queueName: schema.leadQueues.name,
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
      .leftJoin(schema.leadQueues, and(eq(schema.leads.queueId, schema.leadQueues.id), eq(schema.leadQueues.tenantId, context.tenantId)))
      .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
      .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
      .where(and(eq(schema.leads.tenantId, context.tenantId), isNull(schema.leads.deletedAt), ...(scope ? [scope] : [])))
      .orderBy(desc(schema.leads.stageEnteredAt))
      .limit(isDirector ? 500 : 150),
    isDirector
      ? db
          .select({ id: schema.branches.id, name: schema.branches.name })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
          .orderBy(asc(schema.branches.name))
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const leadIds = leads.map((lead) => lead.id);

  const [messageRows, documentRows, aiConversationRows] = leadIds.length
    ? await Promise.all([
      db
        .select({
          id: schema.whatsappMessages.id,
          leadId: schema.whatsappMessages.leadId,
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
        .limit(2000),
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
  for (const lead of leads) {
    const rawMatched = messageRows
      .filter((msg) => msg.leadId === lead.id || (Boolean(msg.phone && lead.telefone) && samePhone(msg.phone, lead.telefone)))
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

    const seenIds = new Set<string>();
    const seenContentKeys = new Set<string>();
    const matched: ConversationMessage[] = [];

    for (const msg of rawMatched) {
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);

      // Deduplicate identical content sent within 5 seconds of each other
      const window5s = Math.floor(msg.sentAt.getTime() / 5000);
      const contentKey = `${msg.direction}:${msg.body.trim()}:${window5s}`;
      if (seenContentKeys.has(contentKey)) continue;
      seenContentKeys.add(contentKey);

      matched.push({
        id: msg.id,
        leadId: lead.id,
        body: msg.body,
        direction: msg.direction,
        senderRole: msg.senderRole,
        providerStatus: msg.providerStatus,
        sentAt: msg.sentAt.toISOString(),
      });
    }

    if (matched.length > 0) {
      messagesByLead.set(lead.id, matched.slice(-200));
    }
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
    let messages = messagesByLead.get(lead.id) ?? [];
    const aiConv = aiConversationsByLead.get(lead.id) ?? null;

    if (messages.length === 0 && aiConv) {
      const syntheticTime = lead.stageEnteredAt || lead.createdAt;
      const initialGreeting = "Olá! Sou o atendente virtual da Âncora Saúde. Vou fazer algumas perguntas rápidas para preparar seu atendimento.";
      messages = [
        {
          id: `synth_ai_start_${lead.id}`,
          leadId: lead.id,
          body: initialGreeting,
          direction: "outbound",
          sentAt: syntheticTime.toISOString(),
        },
      ];
      if (aiConv.qualificationSummary) {
        messages.push({
          id: `synth_ai_summary_${lead.id}`,
          leadId: lead.id,
          body: `Resumo da Qualificação por IA: ${aiConv.qualificationSummary}`,
          direction: "outbound",
          sentAt: new Date(syntheticTime.getTime() + 1000).toISOString(),
        });
      }
    }

    const latest = messages.at(-1) ?? null;
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

  // Deduplicate conversations by phone number so duplicate DB lead records render as 1 contact
  const uniqueConversationsByPhone = new Map<string, ConversationItem>();

  for (const conv of conversations) {
    const rawPhone = conv.telefone ? conv.telefone.replace(/\D/g, "") : "";
    const phoneKey = rawPhone.length >= 8 ? rawPhone.slice(-11) : conv.id;

    const existing = uniqueConversationsByPhone.get(phoneKey);
    if (!existing) {
      uniqueConversationsByPhone.set(phoneKey, conv);
    } else {
      const allMsgs = [...existing.messages, ...conv.messages].sort(
        (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
      );
      const seenMsgIds = new Set<string>();
      const dedupedMsgs = allMsgs.filter((m) => {
        if (seenMsgIds.has(m.id)) return false;
        seenMsgIds.add(m.id);
        return true;
      });

      const isConvDistributed = conv.status === "distributed" || (conv.qualificationStatus && conv.qualificationStatus !== "pending");
      const primary = isConvDistributed ? conv : existing;
      const secondary = primary === conv ? existing : conv;
      const latest = dedupedMsgs.at(-1) ?? null;

      uniqueConversationsByPhone.set(phoneKey, {
        ...primary,
        qualificationStatus: primary.qualificationStatus || secondary.qualificationStatus,
        messages: dedupedMsgs,
        latestMessage: latest ? { body: latest.body, direction: latest.direction, sentAt: latest.sentAt } : primary.latestMessage,
        documents: [...primary.documents, ...secondary.documents],
        aiConversation: primary.aiConversation || secondary.aiConversation,
      });
    }
  }

  const finalConversations = Array.from(uniqueConversationsByPhone.values());
  finalConversations.sort((a, b) => {
    const timeA = a.latestMessage ? new Date(a.latestMessage.sentAt).getTime() : new Date(a.stageEnteredAt).getTime();
    const timeB = b.latestMessage ? new Date(b.latestMessage.sentAt).getTime() : new Date(b.stageEnteredAt).getTime();
    return timeB - timeA;
  });

  let officialBrokerConversations: OfficialBrokerConversation[] = [];
  const officialBrokerMessagesEnabled = officialBrokerTab ? await isMetaCloudWhatsAppEnabled() : false;
  if (officialBrokerTab && officialBrokerMessagesEnabled) {
    const [brokers, invitations, outboundMessages, inboundMessages] = await Promise.all([
      db.select({ id: schema.brokerProfiles.id, userId: schema.brokerProfiles.userId, name: schema.brokerProfiles.professionalName, phone: schema.brokerProfiles.phone, branchName: schema.branches.name })
        .from(schema.brokerProfiles)
        .leftJoin(schema.branches, and(eq(schema.brokerProfiles.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
        .where(eq(schema.brokerProfiles.tenantId, context.tenantId))
        .orderBy(asc(schema.brokerProfiles.professionalName)),
      db.select({ id: schema.brokerInvitations.id, brokerProfileId: schema.brokerInvitations.brokerProfileId, status: schema.brokerInvitations.status, deliveryStatus: schema.brokerInvitations.deliveryStatus, createdAt: schema.brokerInvitations.createdAt })
        .from(schema.brokerInvitations)
        .where(eq(schema.brokerInvitations.tenantId, context.tenantId))
        .orderBy(desc(schema.brokerInvitations.createdAt)),
      db.select({ id: schema.whatsappOutboundMessages.id, recipientId: schema.whatsappOutboundMessages.recipientId, destinationPhone: schema.whatsappOutboundMessages.destinationPhone, purpose: schema.whatsappOutboundMessages.purpose, messageType: schema.whatsappOutboundMessages.messageType, templateName: schema.whatsappOutboundMessages.templateName, status: schema.whatsappOutboundMessages.status, createdAt: schema.whatsappOutboundMessages.createdAt, sentAt: schema.whatsappOutboundMessages.sentAt, deliveredAt: schema.whatsappOutboundMessages.deliveredAt, readAt: schema.whatsappOutboundMessages.readAt, attempts: schema.whatsappOutboundMessages.attempts, providerErrorMessage: schema.whatsappOutboundMessages.providerErrorMessage })
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

    const brokerByProfileId = new Map(brokers.map((b) => [b.id, b]));
    const brokerByUserId = new Map(brokers.filter((b) => b.userId).map((b) => [b.userId!, b]));
    const invitationToBrokerId = new Map(invitations.map((inv) => [inv.id, inv.brokerProfileId]));

    const brokerByPhone = new Map<string, (typeof brokers)[number]>();
    for (const broker of brokers) {
      const digits = normalizePhone(broker.phone);
      if (digits) {
        brokerByPhone.set(digits, broker);
        if (digits.length >= 11) brokerByPhone.set(digits.slice(-11), broker);
        if (digits.length >= 10) brokerByPhone.set(digits.slice(-10), broker);
      }
    }

    const findBroker = (recipientId: string | null, phone: string) => {
      if (recipientId) {
        if (brokerByProfileId.has(recipientId)) return brokerByProfileId.get(recipientId);
        if (brokerByUserId.has(recipientId)) return brokerByUserId.get(recipientId);
        const fromInv = invitationToBrokerId.get(recipientId);
        if (fromInv && brokerByProfileId.has(fromInv)) return brokerByProfileId.get(fromInv);
      }
      const digits = normalizePhone(phone);
      if (!digits) return undefined;
      return brokerByPhone.get(digits)
        || (digits.length >= 11 ? brokerByPhone.get(digits.slice(-11)) : undefined)
        || (digits.length >= 10 ? brokerByPhone.get(digits.slice(-10)) : undefined);
    };

    const invitationByBroker = new Map<string, (typeof invitations)[number]>();
    for (const invitation of invitations) if (!invitationByBroker.has(invitation.brokerProfileId)) invitationByBroker.set(invitation.brokerProfileId, invitation);
    const messagesByBroker = new Map<string, OfficialBrokerMessage[]>();
    const addMessage = (brokerId: string, message: OfficialBrokerMessage) => messagesByBroker.set(brokerId, [...(messagesByBroker.get(brokerId) ?? []), message]);

    for (const message of outboundMessages) {
      const broker = findBroker(message.recipientId, message.destinationPhone);
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
      const broker = findBroker(null, message.phone);
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
      <DashboardHeader
        breadcrumb="Atendimento"
        title="Conversas"
        rightSlot={isDirector ? (
          <nav aria-label="Tipo de conversa" className="flex items-center gap-2">
            <BulkQualificationDialog />
            <Button render={<Link href="/conversas" />} size="sm" variant={officialBrokerTab ? "ghost" : "secondary"}>
              Leads <Badge variant="outline">{finalConversations.length}</Badge>
            </Button>
            <Button render={<Link href="/conversas?tab=corretores" />} size="sm" variant={officialBrokerTab ? "secondary" : "ghost"}>
              Número oficial <span className="hidden lg:inline">· corretores</span>
            </Button>
          </nav>
        ) : undefined}
      />
      <main className="min-h-0 w-full flex-1 bg-background p-0">
        <div className="h-full min-h-[calc(100dvh-var(--header-height,3.5rem))] max-[559px]:min-h-0 w-full overflow-hidden bg-card">
        {officialBrokerTab ? <OfficialBrokerConversations enabled={officialBrokerMessagesEnabled} conversations={officialBrokerConversations} /> : <ConversationsWorkspace
          role={context.role}
          branches={branches}
          conversations={finalConversations}
          initialLeadId={leadId}
          userId={context.userId}
          tenantId={context.tenantId}
        />}
        </div>
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
