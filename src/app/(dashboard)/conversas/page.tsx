import Link from "next/link";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ConversationsWorkspace,
  type ConversationItem,
  type ConversationMessage,
} from "./conversations-workspace";
import {
  OfficialBrokerConversations,
  type OfficialBrokerConversation,
  type OfficialBrokerMessage,
} from "./official-broker-conversations";
import { ConversasHeaderNav } from "./_components/conversas-header-nav";
import { isMetaCloudWhatsAppEnabled, samePhone } from "@/features/communication-channels/service";
import { resolveTemplateTextBody } from "@/features/communication-channels/outbound-service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { getDirectorFacingMetaDeliveryFailure } from "@/features/communication-channels/meta-delivery-failure";
import { getInternalBrokerNotificationPolicy } from "@/features/communication-channels/internal-notification-policy";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { BulkQualificationDialog } from "@/features/ai-qualification/components/bulk-qualification-dialog";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getSystemSetting } from "@/features/system-settings/queries";
import { hasPermission } from "@/shared/auth/permissions";

// Não gerar estaticamente — a página depende de sessão e executa queries pesadas de AI
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; tab?: string }>;
}) {
  const { leadId, tab } = await searchParams;
  const context = await getRequiredTenantContext();
  if (!hasPermission(context.role, "acessar_conversas")) {
    redirect("/minha-fila");
  }

  // A experiência Lite conectada é exclusiva do corretor. Enquanto o controle
  // global estiver desligado, o corretor não pode cair na central geral, pois ela
  // não é a superfície de atendimento dele.
  if (context.role === "broker" && (await getExperienceMode(context)) === "LIGHT") {
    if ((await getSystemSetting("feature_waha_connections_enabled")) === "false") {
      redirect("/minha-fila");
    }
    const params = new URLSearchParams();
    if (leadId) params.set("leadId", leadId);
    redirect(params.size ? `/conversas/broker?${params}` : "/conversas/broker");
  }

  const db = getDatabase();

  const isDirector = context.role === "director";
  const canSeeBrokerTab = isDirector || (context.role === "manager" && Boolean(context.branchId));
  const officialBrokerTab = canSeeBrokerTab && tab === "corretores";
  const scope =
    context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : context.role === "broker"
        ? eq(schema.leads.corretorId, context.userId)
        : undefined;

  let finalConversations: ConversationItem[] = [];
  let branches: { id: string; name: string }[] = [];

  if (!officialBrokerTab) {
    const [leads, branchRows] = await Promise.all([
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
        .leftJoin(
          schema.leadQueues,
          and(
            eq(schema.leads.queueId, schema.leadQueues.id),
            eq(schema.leadQueues.tenantId, context.tenantId),
          ),
        )
        .leftJoin(schema.carrierPlans, eq(schema.leads.planId, schema.carrierPlans.id))
        .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
        .where(
          and(
            eq(schema.leads.tenantId, context.tenantId),
            isNull(schema.leads.deletedAt),
            ...(scope ? [scope] : []),
          ),
        )
        .orderBy(desc(schema.leads.stageEnteredAt))
        .limit(isDirector ? 500 : 150),
      isDirector
        ? db
            .select({ id: schema.branches.id, name: schema.branches.name })
            .from(schema.branches)
            .where(
              and(
                eq(schema.branches.tenantId, context.tenantId),
                eq(schema.branches.status, "active"),
              ),
            )
            .orderBy(asc(schema.branches.name))
        : Promise.resolve([] as { id: string; name: string }[]),
    ]);

    branches = branchRows;
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
              messageId: schema.whatsappMessages.messageId,
              communicationChannelId: schema.whatsappMessages.communicationChannelId,
              sentAt: schema.whatsappMessages.sentAt,
            })
            .from(schema.whatsappMessages)
            .where(eq(schema.whatsappMessages.tenantId, context.tenantId))
            .orderBy(desc(schema.whatsappMessages.sentAt))
            .limit(2000),
          db
            .select({
              id: schema.leadDocuments.id,
              leadId: schema.leadDocuments.leadId,
              filename: schema.leadDocuments.filename,
              fileUrl: schema.leadDocuments.fileUrl,
              status: schema.leadDocuments.status,
              requirementName: schema.documentRequirements.name,
              createdAt: schema.leadDocuments.createdAt,
            })
            .from(schema.leadDocuments)
            .leftJoin(
              schema.documentRequirements,
              eq(schema.leadDocuments.requirementId, schema.documentRequirements.id),
            )
            .where(
              and(
                eq(schema.leadDocuments.tenantId, context.tenantId),
                inArray(schema.leadDocuments.leadId, leadIds),
              ),
            )
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
            .where(
              and(
                eq(schema.aiConversations.tenantId, context.tenantId),
                inArray(schema.aiConversations.leadId, leadIds),
              ),
            )
            .catch(() => []),
        ])
      : ([[], [], []] as const);

    const failedMessageEventKeys = isDirector
      ? Array.from(
          new Set(
            messageRows
              .filter((message) => message.providerStatus === "failed" || message.providerStatus === "deleted")
              .flatMap((message) =>
                message.messageId
                  ? [`${message.messageId}:failed`, `${message.messageId}:deleted`]
                  : [],
              ),
          ),
        )
      : [];

    const failedDeliveryEvents = failedMessageEventKeys.length
      ? await db
          .select({
            externalEventId: schema.communicationChannelWebhookEvents.externalEventId,
            errorCode: schema.communicationChannelWebhookEvents.errorCode,
          })
          .from(schema.communicationChannelWebhookEvents)
          .innerJoin(
            schema.communicationChannels,
            eq(
              schema.communicationChannelWebhookEvents.channelId,
              schema.communicationChannels.id,
            ),
          )
          .where(
            and(
              eq(schema.communicationChannels.tenantId, context.tenantId),
              inArray(
                schema.communicationChannelWebhookEvents.externalEventId,
                failedMessageEventKeys,
              ),
            ),
          )
      : [];

    const failureByProviderMessageId = new Map(
      failedDeliveryEvents.flatMap((event) => {
        if (!event.externalEventId || !event.errorCode) return [];
        const messageId = event.externalEventId.replace(/:(?:failed|deleted)$/, "");
        const failure = getDirectorFacingMetaDeliveryFailure(event.errorCode);
        return failure ? [[messageId, failure] as const] : [];
      }),
    );

    const messagesByLead = new Map<string, ConversationMessage[]>();
    for (const lead of leads) {
      const rawMatched = messageRows
        .filter(
          (msg) =>
            msg.leadId === lead.id ||
            (Boolean(msg.phone && lead.telefone) && samePhone(msg.phone, lead.telefone)),
        )
        .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

      const seenIds = new Set<string>();
      const seenContentKeys = new Set<string>();
      const deduplicated: ConversationMessage[] = [];

      for (const msg of rawMatched) {
        if (seenIds.has(msg.id)) continue;
        seenIds.add(msg.id);

        const normalizedBody = msg.body?.trim().toLowerCase() || "";
        const timeBucket = Math.floor(msg.sentAt.getTime() / 2000);
        const contentKey = `${msg.direction}:${normalizedBody}:${timeBucket}`;

        if (normalizedBody.length > 0 && seenContentKeys.has(contentKey)) {
          continue;
        }
        seenContentKeys.add(contentKey);

        const providerFailure = msg.messageId
          ? failureByProviderMessageId.get(msg.messageId) ?? null
          : null;

        deduplicated.push({
          id: msg.id,
          leadId: lead.id,
          body: msg.body,
          direction: msg.direction,
          senderRole: msg.senderRole,
          providerStatus: msg.providerStatus,
          providerFailure,
          sentAt: msg.sentAt.toISOString(),
        });
      }

      messagesByLead.set(lead.id, deduplicated);
    }

    const documentsByLead = new Map<
      string,
      {
        id: string;
        filename: string;
        fileUrl: string;
        status: string;
        requirementName: string | null;
        createdAt: string;
      }[]
    >();
    for (const doc of documentRows) {
      if (!doc.leadId) continue;
      const list = documentsByLead.get(doc.leadId) || [];
      list.push({
        id: doc.id,
        filename: doc.filename,
        fileUrl: doc.fileUrl,
        status: doc.status,
        requirementName: doc.requirementName,
        createdAt: doc.createdAt.toISOString(),
      });
      documentsByLead.set(doc.leadId, list);
    }

    const aiConversationByLead = new Map<string, {
      id: string;
      status: "NEW" | "AI_ACTIVE" | "WAITING_CUSTOMER" | "WAITING_HUMAN" | "HUMAN_ACTIVE" | "CLOSED" | "FAILED";
      aiModel: string | null;
      transferReason: string | null;
      qualificationSummary: string | null;
      assignedUserId: string | null;
    }>();
    for (const row of aiConversationRows) {
      if (!row.leadId) continue;
      aiConversationByLead.set(row.leadId, {
        id: row.id,
        status: row.status as "NEW" | "AI_ACTIVE" | "WAITING_CUSTOMER" | "WAITING_HUMAN" | "HUMAN_ACTIVE" | "CLOSED" | "FAILED",
        aiModel: row.aiModel,
        transferReason: row.transferReason,
        qualificationSummary: row.qualificationSummary,
        assignedUserId: row.assignedUserId,
      });
    }

    const unassignedSyntheticId = "00000000-0000-0000-0000-000000000000";
    const leadPhones = new Set<string>();
    for (const l of leads) {
      if (l.telefone) {
        leadPhones.add(l.telefone.replace(/\D/g, ""));
      }
    }

    const unlinkedMessages = messageRows.filter((msg) => {
      if (msg.leadId) return false;
      if (!msg.phone) return false;
      const clean = msg.phone.replace(/\D/g, "");
      return !leadPhones.has(clean) && !leadPhones.has(clean.slice(-11));
    });

    const unlinkedByPhone = new Map<string, typeof unlinkedMessages>();
    for (const msg of unlinkedMessages) {
      if (!msg.phone) continue;
      const key = msg.phone.replace(/\D/g, "");
      const current = unlinkedByPhone.get(key) || [];
      current.push(msg);
      unlinkedByPhone.set(key, current);
    }

    const syntheticLeadConversations: ConversationItem[] = [];
    for (const [phone, msgs] of unlinkedByPhone.entries()) {
      msgs.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
      const latest = msgs[msgs.length - 1];
      const rawBody = latest?.body || "Conversa iniciada pelo WhatsApp";
      const snippet = rawBody.length > 80 ? `${rawBody.slice(0, 80)}...` : rawBody;
      const syntheticId = `unassigned-${phone}`;

      syntheticLeadConversations.push({
        id: syntheticId,
        nome: `Contato (${phone})`,
        telefone: phone,
        email: null,
        status: "new",
        qualificationStatus: "PENDING",
        origem: "whatsapp_unassigned",
        branchId: null,
        queueName: "Fila Geral WhatsApp",
        corretorId: unassignedSyntheticId,
        corretorNome: "Não atribuído",
        branchName: "Entrada Geral",
        consentimentoLgpd: false,
        createdAt: latest?.sentAt.toISOString() || new Date().toISOString(),
        stageEnteredAt: latest?.sentAt.toISOString() || new Date().toISOString(),
        planName: null,
        carrierName: null,
        messages: msgs.map((m) => ({
          id: m.id,
          leadId: syntheticId,
          body: m.body,
          direction: m.direction,
          senderRole: m.senderRole,
          providerStatus: m.providerStatus,
          providerFailure: m.messageId ? failureByProviderMessageId.get(m.messageId) ?? null : null,
          sentAt: m.sentAt.toISOString(),
        })),
        documents: [],
        latestMessage: latest
          ? {
              body: snippet,
              direction: latest.direction,
              sentAt: latest.sentAt.toISOString(),
            }
          : null,
      });
    }

    const mappedLeadConversations: ConversationItem[] = leads.map((lead) => {
      const messages = messagesByLead.get(lead.id) || [];
      const documents = documentsByLead.get(lead.id) || [];
      const aiConversation = aiConversationByLead.get(lead.id) || null;
      const latestMessage = messages[messages.length - 1];

      return {
        id: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        status: lead.status,
        qualificationStatus: lead.qualificationStatus,
        origem: lead.origem,
        branchId: lead.branchId,
        queueName: lead.queueName,
        corretorId: lead.corretorId,
        corretorNome: lead.corretorNome,
        branchName: lead.branchName,
        consentimentoLgpd: lead.consentimentoLgpd,
        createdAt: lead.createdAt.toISOString(),
        stageEnteredAt: lead.stageEnteredAt ? lead.stageEnteredAt.toISOString() : lead.createdAt.toISOString(),
        planName: lead.planName,
        carrierName: lead.carrierName,
        messages,
        documents,
        aiConversation,
        latestMessage: latestMessage
          ? {
              body: latestMessage.body,
              direction: latestMessage.direction,
              sentAt: latestMessage.sentAt,
            }
          : null,
      };
    });

    const allConversations = [...mappedLeadConversations, ...syntheticLeadConversations];
    const uniqueConversationsByPhone = new Map<string, ConversationItem>();

    for (const conv of allConversations) {
      const phone = conv.telefone ? conv.telefone.replace(/\D/g, "") : "";
      if (!phone) {
        uniqueConversationsByPhone.set(conv.id, conv);
        continue;
      }
      const existing = uniqueConversationsByPhone.get(phone);
      if (!existing) {
        uniqueConversationsByPhone.set(phone, conv);
      } else {
        const primary = existing.id.startsWith("unassigned-") ? conv : existing;
        const secondary = existing.id.startsWith("unassigned-") ? existing : conv;
        const mergedMessages = [...primary.messages];
        const seenMsgIds = new Set(primary.messages.map((m) => m.id));
        for (const msg of secondary.messages) {
          if (!seenMsgIds.has(msg.id)) {
            seenMsgIds.add(msg.id);
            mergedMessages.push(msg);
          }
        }
        mergedMessages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

        uniqueConversationsByPhone.set(phone, {
          ...primary,
          messages: mergedMessages,
          latestMessage: mergedMessages[mergedMessages.length - 1]
            ? {
                body: mergedMessages[mergedMessages.length - 1].body,
                direction: mergedMessages[mergedMessages.length - 1].direction,
                sentAt: mergedMessages[mergedMessages.length - 1].sentAt,
              }
            : primary.latestMessage,
          aiConversation: primary.aiConversation || secondary.aiConversation,
        });
      }
    }

    finalConversations = Array.from(uniqueConversationsByPhone.values());
    finalConversations.sort((a, b) => {
      const timeA = a.latestMessage
        ? new Date(a.latestMessage.sentAt).getTime()
        : new Date(a.stageEnteredAt).getTime();
      const timeB = b.latestMessage
        ? new Date(b.latestMessage.sentAt).getTime()
        : new Date(b.stageEnteredAt).getTime();
      return timeB - timeA;
    });
  }

  let officialBrokerConversations: OfficialBrokerConversation[] = [];
  let officialBrokerMessagesEnabled = false;
  let internalBrokerDeliveryChannel: "meta" | "waha_direct" = "meta";

  if (officialBrokerTab) {
    const [metaCloudEnabled, internalBrokerPolicy] = await Promise.all([
      isMetaCloudWhatsAppEnabled(),
      getInternalBrokerNotificationPolicy(context.tenantId),
    ]);
    officialBrokerMessagesEnabled = metaCloudEnabled || Boolean(
      internalBrokerPolicy?.enabled && internalBrokerPolicy.deliveryMode === "waha_direct" && internalBrokerPolicy.wahaNumberId,
    );
    internalBrokerDeliveryChannel =
      internalBrokerPolicy?.enabled &&
      internalBrokerPolicy.deliveryMode === "waha_direct" &&
      internalBrokerPolicy.wahaNumberId
        ? "waha_direct" as const
        : "meta" as const;

    if (officialBrokerMessagesEnabled) {
      const brokers = await db
        .select({
          id: schema.brokerProfiles.id,
          userId: schema.brokerProfiles.userId,
          name: schema.brokerProfiles.professionalName,
          phone: schema.brokerProfiles.phone,
          branchName: schema.branches.name,
        })
        .from(schema.brokerProfiles)
        .leftJoin(
          schema.branches,
          and(
            eq(schema.brokerProfiles.branchId, schema.branches.id),
            eq(schema.branches.tenantId, context.tenantId),
          ),
        )
        .where(and(
          eq(schema.brokerProfiles.tenantId, context.tenantId),
          context.role === "manager" ? eq(schema.brokerProfiles.branchId, context.branchId!) : undefined,
        ))
        .orderBy(asc(schema.brokerProfiles.professionalName));

      const brokerProfileIds = brokers.map((broker) => broker.id);
      const brokerUserIds = brokers.flatMap((broker) => broker.userId ? [broker.userId] : []);
      const brokerPhones = brokers.flatMap((broker) => {
        const phone = normalizePhone(broker.phone);
        return phone ? [phone] : [];
      });

      const [invitations, outboundMessages, inboundMessages] = brokerProfileIds.length > 0
        ? await Promise.all([
            db
              .select({
                id: schema.brokerInvitations.id,
                brokerProfileId: schema.brokerInvitations.brokerProfileId,
                status: schema.brokerInvitations.status,
                deliveryStatus: schema.brokerInvitations.deliveryStatus,
                createdAt: schema.brokerInvitations.createdAt,
              })
              .from(schema.brokerInvitations)
              .where(and(eq(schema.brokerInvitations.tenantId, context.tenantId), inArray(schema.brokerInvitations.brokerProfileId, brokerProfileIds)))
              .orderBy(desc(schema.brokerInvitations.createdAt)),
            db
              .select({
                id: schema.whatsappOutboundMessages.id,
                recipientId: schema.whatsappOutboundMessages.recipientId,
                destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
                purpose: schema.whatsappOutboundMessages.purpose,
                messageType: schema.whatsappOutboundMessages.messageType,
                templateName: schema.whatsappOutboundMessages.templateName,
                variables: schema.whatsappOutboundMessages.variables,
                status: schema.whatsappOutboundMessages.status,
                createdAt: schema.whatsappOutboundMessages.createdAt,
                sentAt: schema.whatsappOutboundMessages.sentAt,
                deliveredAt: schema.whatsappOutboundMessages.deliveredAt,
                readAt: schema.whatsappOutboundMessages.readAt,
                attempts: schema.whatsappOutboundMessages.attempts,
                deliveryRoute: schema.whatsappOutboundMessages.deliveryRoute,
                providerErrorMessage: schema.whatsappOutboundMessages.providerErrorMessage,
              })
              .from(schema.whatsappOutboundMessages)
              .leftJoin(
                schema.communicationChannels,
                and(
                  eq(schema.whatsappOutboundMessages.channelId, schema.communicationChannels.id),
                  eq(schema.communicationChannels.tenantId, context.tenantId),
                ),
              )
              .where(
                and(
                  eq(schema.whatsappOutboundMessages.tenantId, context.tenantId),
                  eq(schema.whatsappOutboundMessages.recipientType, "user"),
                  or(
                    inArray(schema.whatsappOutboundMessages.recipientId, [...brokerProfileIds, ...brokerUserIds]),
                    inArray(schema.whatsappOutboundMessages.destinationPhone, brokerPhones),
                  ),
                ),
              )
              .orderBy(desc(schema.whatsappOutboundMessages.createdAt))
              .limit(500),
            db
              .select({
                id: schema.whatsappMessages.id,
                phone: schema.whatsappMessages.phone,
                body: schema.whatsappMessages.body,
                providerStatus: schema.whatsappMessages.providerStatus,
                sentAt: schema.whatsappMessages.sentAt,
              })
              .from(schema.whatsappMessages)
              .where(
                and(
                  eq(schema.whatsappMessages.tenantId, context.tenantId),
                  eq(schema.whatsappMessages.direction, "incoming"),
                  inArray(schema.whatsappMessages.phone, brokerPhones),
                ),
              )
              .orderBy(desc(schema.whatsappMessages.sentAt))
              .limit(500),
          ])
        : [[], [], []] as const;

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
        return (
          brokerByPhone.get(digits) ??
          (digits.length >= 11 ? brokerByPhone.get(digits.slice(-11)) : undefined) ??
          (digits.length >= 10 ? brokerByPhone.get(digits.slice(-10)) : undefined)
        );
      };

      const messagesByBroker = new Map<string, OfficialBrokerMessage[]>();
      const addMessage = (brokerId: string, message: OfficialBrokerMessage) => {
        const current = messagesByBroker.get(brokerId) ?? [];
        current.push(message);
        messagesByBroker.set(brokerId, current);
      };

      for (const message of outboundMessages) {
        const broker = findBroker(message.recipientId, message.destinationPhone);
        if (!broker) continue;
        addMessage(broker.id, {
          id: `out:${message.id}`,
          direction: "outgoing",
          body: formatOfficialOutboundBody(
            message.purpose,
            message.messageType,
            message.templateName,
            message.variables,
          ),
          sentAt: (message.sentAt ?? message.createdAt).toISOString(),
          status: normalizeOutboundStatus(message.status),
          purpose: message.purpose,
          templateName: message.templateName,
          attempts: message.attempts,
          error:
            message.status === "failed" || (message.status === "pending" && Boolean(message.providerErrorMessage))
              ? getOfficialBrokerDeliveryError(message.deliveryRoute, message.providerErrorMessage)
              : null,
        });
      }

      for (const message of inboundMessages) {
        const broker = findBroker(null, message.phone);
        if (!broker) continue;
        const cleanBody = message.body?.trim();
        addMessage(broker.id, {
          id: `in:${message.id}`,
          direction: "incoming",
          body: cleanBody && cleanBody !== "[text]" ? cleanBody : "Mensagem recebida do corretor",
          sentAt: message.sentAt.toISOString(),
          status: "received",
        });
      }

      const invitationByBroker = new Map<string, (typeof invitations)[number]>();
      for (const inv of invitations) {
        if (!invitationByBroker.has(inv.brokerProfileId)) {
          invitationByBroker.set(inv.brokerProfileId, inv);
        }
      }

      officialBrokerConversations = brokers
        .map((broker) => {
          const invitation = invitationByBroker.get(broker.id);
          const brokerMsgs = (messagesByBroker.get(broker.id) ?? []).sort(
            (left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime(),
          );
          return {
            brokerProfileId: broker.id,
            name: broker.name,
            phoneMasked: maskPhone(broker.phone),
            phoneRaw: broker.phone,
            branchName: broker.branchName,
            invitationStatus: invitation?.status ?? null,
            invitationDeliveryStatus: invitation?.deliveryStatus ?? null,
            messages: brokerMsgs,
          };
        })
        .filter(
          (conversation) =>
            conversation.messages.length > 0 || Boolean(conversation.invitationStatus),
        )
        .sort((a, b) => {
          const lastA = a.messages.at(-1)?.sentAt;
          const lastB = b.messages.at(-1)?.sentAt;
          const timeA = lastA ? new Date(lastA).getTime() : 0;
          const timeB = lastB ? new Date(lastB).getTime() : 0;
          if (timeA !== timeB) return timeB - timeA;
          return a.name.localeCompare(b.name, "pt-BR");
        });

      await db
        .insert(schema.auditLogs)
        .values({
          id: randomUUID(),
          userId: context.userId,
          entidade: "official_broker_conversations",
          entidadeId: context.tenantId,
          acao: "consultou_historico",
        });
    }
  }

  return (
    <>
      <DashboardHeader
        breadcrumb="Atendimento"
        title="Conversas"
        rightSlot={
          canSeeBrokerTab ? (
            <nav aria-label="Tipo de conversa" className="flex items-center gap-3">
              <BulkQualificationDialog />
              <ConversasHeaderNav
                currentTab={officialBrokerTab ? "corretores" : "leads"}
                leadsCount={!officialBrokerTab ? finalConversations.length : undefined}
              />
            </nav>
          ) : undefined
        }
      />
      <main className="min-h-0 w-full flex-1 bg-background p-0">
        <div className="h-full min-h-[calc(100dvh-var(--header-height,3.5rem))] max-[559px]:min-h-0 w-full overflow-hidden bg-card">
          {officialBrokerTab ? (
            <OfficialBrokerConversations
              enabled={officialBrokerMessagesEnabled}
              deliveryChannel={internalBrokerDeliveryChannel}
              conversations={officialBrokerConversations}
            />
          ) : (
            <ConversationsWorkspace
              role={context.role}
              branches={branches}
              conversations={finalConversations}
              initialLeadId={leadId}
              userId={context.userId}
              tenantId={context.tenantId}
            />
          )}
        </div>
      </main>
    </>
  );
}

import { normalizePhone, maskPhone } from "@/shared/utils/phone";
function normalizeOutboundStatus(status: string): OfficialBrokerMessage["status"] {
  return ["pending", "queued", "sent", "delivered", "read", "failed"].includes(status)
    ? (status as OfficialBrokerMessage["status"])
    : "queued";
}
function getOfficialBrokerDeliveryError(deliveryRoute: string, providerErrorMessage: string | null) {
  if (deliveryRoute === "waha_direct") {
    return "O WAHA não confirmou o envio. Verifique a conexão do número selecionado e tente novamente.";
  }
  return providerErrorMessage ?? "A Meta não confirmou a entrega. Consulte o status do canal e reenvie pelo fluxo de equipe.";
}
function formatOfficialOutboundBody(
  purpose: string,
  messageType: string,
  templateName: string,
  rawVariables: unknown,
): string {
  const variables = Array.isArray(rawVariables) ? (rawVariables as string[]) : [];

  if (messageType === "text" && variables[0]?.trim()) {
    return variables[0].trim();
  }

  const resolved = resolveTemplateTextBody(purpose, variables);
  if (resolved) return resolved;

  if (purpose === "brokerInvitation") return "Convite para criar o primeiro acesso no AncoraHub.";
  if (purpose === "newLeadAssignment") return "Oferta de novo lead enviada ao corretor.";
  if (purpose === "leadAssignmentConfirmed")
    return "Confirmação de lead atribuído enviada ao corretor.";
  return `Modelo oficial enviado: ${templateName}.`;
}
