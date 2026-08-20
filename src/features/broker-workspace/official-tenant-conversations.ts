import { samePhone } from "@/features/communication-channels/service";

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

export function buildOfficialTenantConversations(
  contacts: OfficialTenantContact[],
  messages: OfficialTenantMessage[],
) {
  return contacts.map((contact) => {
    const contactMessages = messages
      .filter((message) => samePhone(message.phone, contact.phone))
      .sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt))
      .slice(-100);
    const latest = contactMessages.at(-1) ?? null;

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
      messages: contactMessages.map((message) => ({
        id: message.id,
        body: message.body,
        direction: message.direction,
        sentAt: message.sentAt,
        senderRole: message.senderRole,
        providerStatus: message.providerStatus,
      })),
    };
  });
}
