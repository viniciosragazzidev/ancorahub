import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/**
 * WhatsApp Status ("stories") arrive on the chat `status@broadcast`. WAHA stored
 * them as ordinary inbound messages with the poster's phone, so a broker's or a
 * client's story showed up as if they had written to the company (21/10: Vanessa
 * Accioly's thread showed her story videos "Cantinho que amo!"). The stored id
 * keeps the chat: `false_status@broadcast_<id>_<participant>@lid`.
 */
export const STATUS_BROADCAST_JID = "status@broadcast";

export function isStatusBroadcastMessage(row: { messageId?: string | null; phone?: string | null }) {
  const pattern = /status@broadcast/i;
  return Boolean((row.messageId && pattern.test(row.messageId)) || (row.phone && pattern.test(row.phone)));
}

/** SQL guard with the same rule, for queries over whatsapp_messages.message_id. */
export function notStatusBroadcastSql(messageIdColumn: AnyColumn): SQL {
  return sql`coalesce(${messageIdColumn}, '') not ilike ${`%${STATUS_BROADCAST_JID}%`}`;
}
