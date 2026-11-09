import { sql, type SQL } from "drizzle-orm";

/**
 * Which WhatsApp rows count as a sign of life for the negotiation timing.
 *
 * Content (text or a file) always counts. A textless incoming row ("[text]")
 * has no content, but it proves the client wrote: when a client's text is
 * lost on the way in, the lead must not look silent and drop out of the
 * Fechamento view. The exception is the echo of the broker's own message
 * (same WhatsApp id with "false_" instead of "true_", see
 * `ownMessageTwinId` in waha-cadence/inbound.ts): the client never wrote it.
 *
 * Textless outgoing rows still never count, and nothing here reads the body
 * as content (PDF and image signals keep requiring a file).
 */
export type NegotiationMessageSignal = {
  direction: string;
  body: string | null;
  mediaKind: string | null;
  messageId: string | null;
  /** The broker's "true_" twin of this message id is stored. */
  ownTwinExists: boolean;
};

export function isContentlessBody(body: string | null) {
  const text = (body ?? "").trim().toLowerCase();
  return text === "" || text === "[text]";
}

export function countsForNegotiationTiming(message: NegotiationMessageSignal) {
  if (message.mediaKind !== null || !isContentlessBody(message.body)) return true;
  if (message.direction !== "incoming") return false;
  const isEcho = (message.messageId ?? "").startsWith("false_") && message.ownTwinExists;
  return !isEcho;
}

const ALIAS = /^[a-z_][a-z0-9_]*$/;

/**
 * SQL twin of `countsForNegotiationTiming` for a `whatsapp_messages` row
 * aliased as `alias` (a fixed identifier from code, never user input).
 */
export function negotiationTimingSignalSql(alias: string): SQL {
  if (!ALIAS.test(alias)) throw new Error("Alias inválido.");
  return sql.raw(`(
    ${alias}.media_kind is not null
    or lower(trim(coalesce(${alias}.body, ''))) not in ('', '[text]')
    or (
      ${alias}.direction = 'incoming'
      and not (
        coalesce(${alias}.message_id, '') like 'false\\_%'
        and exists (
          select 1 from whatsapp_messages own_twin
          where own_twin.tenant_id = ${alias}.tenant_id
            and own_twin.message_id = 'true_' || substr(${alias}.message_id, 7)
        )
      )
    )
  )`);
}
