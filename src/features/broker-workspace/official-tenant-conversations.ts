import { samePhone } from "@/features/communication-channels/service";
import { resolveTemplateTextBody } from "@/features/communication-channels/outbound-service";

export type OfficialTenantContact = {
  id: string;
  source: "number" | "channel";
  name: string;
  phone: string;
};

export type OfficialTenantMessage = {
  id: string;
  body: string;
  direction: string;
  sentAt: string;
  phone: string;
  senderRole?: string | null;
  providerStatus?: string | null;
};

export function formatOfficialOutboundBody(
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
  if (messageType === "text") return "Mensagem de texto enviada pelo número oficial.";
  return `Modelo oficial enviado: ${templateName}.`;
}

export function buildOfficialTenantConversations(
  contacts: OfficialTenantContact[],
  messages: OfficialTenantMessage[],
  outbounds: Array<{
    id: string;
    purpose: string;
    messageType: string;
    templateName: string;
    variables: unknown;
    status: string;
    createdAt: Date;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    channelId: string | null;
    destinationPhone?: string | null;
  }> = [],
) {
  return contacts.map((contact) => {
    const contactMessages = messages
      .filter((message) => samePhone(message.phone, contact.phone))
      .map((message) => ({
        id: message.id,
        body: message.body,
        direction: message.direction,
        sentAt: message.sentAt,
        senderRole: message.senderRole,
        providerStatus: message.providerStatus,
      }));

    const outboundMessages = outbounds
      .filter((outbound) => !outbound.channelId || outbound.channelId === contact.id)
      .map((outbound) => ({
        id: `out:${outbound.id}`,
        body: formatOfficialOutboundBody(
          outbound.purpose,
          outbound.messageType,
          outbound.templateName,
          outbound.variables,
        ),
        direction: "incoming" as const,
        sentAt: (
          outbound.readAt ??
          outbound.deliveredAt ??
          outbound.sentAt ??
          outbound.createdAt
        ).toISOString(),
        senderRole: "system",
        providerStatus: outbound.status,
      }));

    const allMessages = [...contactMessages, ...outboundMessages]
      .sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt))
      .slice(-100);

    const latest = allMessages.at(-1) ?? null;

    return {
      id: `${contact.source === "channel" ? "tenant-channel" : "tenant-number"}:${contact.id}`,
      kind: "tenant_number" as const,
      sendTarget:
        contact.source === "channel"
          ? { kind: "tenant_channel" as const, channelId: contact.id }
          : { kind: "tenant_number" as const, numberId: contact.id },
      nome: contact.name,
      telefone: contact.phone,
      status: "Número oficial",
      latestMessage: latest
        ? { body: latest.body, direction: latest.direction, sentAt: latest.sentAt }
        : null,
      messages: allMessages,
    };
  });
}

