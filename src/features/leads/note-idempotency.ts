import { z } from "zod";

/**
 * Chave de idempotência da nota enviada pela conversa do Lite: o id da mensagem otimista,
 * gerado uma vez no cliente e repetido no "Tentar de novo". Fica guardada em
 * lead_interactions.metadata.clientMessageId (jsonb já existente, sem migração).
 */
export const clientMessageIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9:_-]+$/);

/** Chave do lock transacional que serializa envios repetidos da mesma mensagem. */
export function noteIdempotencyLockKey(leadId: string, userId: string, clientMessageId: string): string {
  return `lead-note:${leadId}:${userId}:${clientMessageId}`;
}
