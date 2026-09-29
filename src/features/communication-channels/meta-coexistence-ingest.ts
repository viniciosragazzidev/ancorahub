import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";

import { publishConversationInvalidation } from "@/features/notifications/realtime-sync";
import { getDatabase, schema } from "@/shared/db";

import {
  countStateSyncContacts,
  readHistory,
  readMessageEchoes,
  readPartnerRemoved,
  type CoexistenceMessage,
} from "./meta-coexistence-events";
import { META_CLOUD_PROVIDER } from "./types";

type ChangeValue = Record<string, unknown> & { metadata?: { phone_number_id?: string; display_phone_number?: string } };

/** Lead (open one first) and client of a customer phone, matched by its last 8 digits. */
async function findLeadAndClient(tenantId: string, customerPhone: string) {
  const db = getDatabase();
  const suffix = customerPhone.slice(-8);
  const [lead] = await db.select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt), sql`regexp_replace(${schema.leads.telefone}, '[^0-9]', '', 'g') LIKE ${"%" + suffix}`))
    .orderBy(sql`case when ${schema.leads.status} in ('in_contact','quote_sent','negotiation','documentation_pending','under_analysis') then 0 else 1 end`)
    .limit(1);
  const [client] = await db.select({ id: schema.clients.id })
    .from(schema.clients)
    .where(and(eq(schema.clients.tenantId, tenantId), sql`regexp_replace(${schema.clients.telefone}, '[^0-9]', '', 'g') LIKE ${"%" + suffix}`))
    .limit(1);
  return { leadId: lead?.id ?? null, clientId: client?.id ?? null };
}

/** Stores app messages as history only: idempotent by message id, no AI, no intake. */
async function storeMessages(channel: { id: string; tenantId: string }, messages: CoexistenceMessage[]) {
  const db = getDatabase();
  const byPhone = new Map<string, CoexistenceMessage[]>();
  for (const message of messages) byPhone.set(message.customerPhone, [...(byPhone.get(message.customerPhone) ?? []), message]);
  let stored = 0;
  for (const [customerPhone, group] of byPhone) {
    const { leadId, clientId } = await findLeadAndClient(channel.tenantId, customerPhone);
    const rows = await db.insert(schema.whatsappMessages).values(group.map((message) => ({
      id: randomUUID(),
      tenantId: channel.tenantId,
      leadId,
      clientId,
      communicationChannelId: channel.id,
      // A person in the app is a human attendant, never the assistant.
      senderRole: message.direction === "outgoing" ? "agent" : "user",
      provider: META_CLOUD_PROVIDER,
      providerStatus: message.direction === "outgoing" ? "sent" : "received",
      messageId: message.providerMessageId,
      phone: customerPhone,
      direction: message.direction,
      body: message.body,
      sentAt: message.sentAt,
    }))).onConflictDoNothing({ target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId] }).returning({ id: schema.whatsappMessages.id });
    stored += rows.length;
  }
  if (stored) void publishConversationInvalidation({ tenantId: channel.tenantId }).catch(() => undefined);
  return stored;
}

export async function ingestCoexistenceChange(input: { wabaId: string | undefined; field: string; value: ChangeValue | undefined }) {
  const db = getDatabase();

  if (input.field === "account_update") {
    const removed = readPartnerRemoved(input.value as { event?: string; phone_number?: string } | undefined);
    if (!removed || !input.wabaId) return { processed: 0, ignored: 1 };
    const channels = await db.select({ id: schema.communicationChannels.id, displayPhoneNumber: schema.communicationChannels.displayPhoneNumber, createdBy: schema.communicationChannels.createdBy })
      .from(schema.communicationChannels)
      .where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.wabaId, input.wabaId), eq(schema.communicationChannels.onboardingMode, "coexistence")));
    const targets = removed.phone
      ? channels.filter((channel) => (channel.displayPhoneNumber ?? "").replace(/\D/g, "").endsWith(removed.phone.slice(-8)))
      : channels;
    for (const channel of targets) {
      // Sending stops; the history and audit stay.
      await db.update(schema.communicationChannels).set({ status: "inactive", syncError: "Desconectado pelo aplicativo WhatsApp Business.", updatedAt: new Date() }).where(eq(schema.communicationChannels.id, channel.id));
      if (channel.createdBy) await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: channel.createdBy, entidade: "communication_channel", entidadeId: channel.id, acao: "meta_cloud_channel_coexistence_partner_removed" });
    }
    return { processed: targets.length, ignored: targets.length ? 0 : 1 };
  }

  const phoneNumberId = input.value?.metadata?.phone_number_id;
  if (!phoneNumberId) return { processed: 0, ignored: 1 };
  const [channel] = await db.select({ id: schema.communicationChannels.id, tenantId: schema.communicationChannels.tenantId, displayPhoneNumber: schema.communicationChannels.displayPhoneNumber })
    .from(schema.communicationChannels)
    .where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.phoneNumberId, phoneNumberId)))
    .limit(1);
  if (!channel) return { processed: 0, ignored: 1 };
  await db.update(schema.communicationChannels).set({ lastWebhookAt: new Date() }).where(eq(schema.communicationChannels.id, channel.id));

  if (input.field === "smb_message_echoes") {
    const stored = await storeMessages(channel, readMessageEchoes(input.value as Parameters<typeof readMessageEchoes>[0]));
    console.info("[whatsapp/coexistence] echoes.stored", { tenantId: channel.tenantId, stored });
    return { processed: 1, ignored: 0 };
  }

  if (input.field === "history") {
    const history = readHistory(input.value as Parameters<typeof readHistory>[0], input.value?.metadata?.display_phone_number ?? channel.displayPhoneNumber);
    const stored = await storeMessages(channel, history.messages);
    if (history.errors.length || history.progress === 100) {
      await db.update(schema.communicationChannels).set({
        syncStatus: "done",
        ...(history.errors.length ? { syncError: `Histórico não compartilhado: ${history.errors.join(" | ")}`.slice(0, 480) } : {}),
        updatedAt: new Date(),
      }).where(eq(schema.communicationChannels.id, channel.id));
    }
    console.info("[whatsapp/coexistence] history.stored", { tenantId: channel.tenantId, stored, progress: history.progress, errors: history.errors.length });
    return { processed: 1, ignored: 0 };
  }

  if (input.field === "smb_app_state_sync") {
    console.info("[whatsapp/coexistence] contacts.received", { tenantId: channel.tenantId, contacts: countStateSyncContacts(input.value as Parameters<typeof countStateSyncContacts>[0]) });
    return { processed: 1, ignored: 0 };
  }
  return { processed: 0, ignored: 1 };
}
