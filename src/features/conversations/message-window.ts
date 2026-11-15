/**
 * Janela de mensagens do /conversas (26/10, Egress do Supabase): a lista lê só um índice leve das
 * mensagens (sem texto nem mídia) e o texto completo vem apenas para o que a tela mostra: as últimas
 * de cada conversa (prévia e ordem da lista) e o histórico da conversa aberta. Antes, cada recarga
 * trazia até 2000 + 4000 mensagens inteiras, a maior fonte de Egress do banco.
 */

export type MessageIndexRow = {
  id: string;
  leadId: string | null;
  clientId: string | null;
  phone: string | null;
  direction: string;
  sentAt: Date;
  communicationChannelId: string | null;
  provider?: string | null;
  previewBody?: string;
  latestInboundChannelId?: string | null;
  latestInboundAt?: Date | null;
  /** SQL preview query returns one row per conversation and carries its aggregate. */
  conversationKey?: string;
  conversationMessageCount?: number;
  conversationHasIncoming?: boolean;
  conversationHasCoex?: boolean;
};

/** Limite para helpers usados por callers que ainda pedem mais de uma linha de prévia. */
export const PREVIEW_MESSAGES_PER_CONVERSATION = 3;
/** Histórico da conversa aberta: as mais recentes, o suficiente para a tela sem reler o lead inteiro. */
export const OPEN_THREAD_MESSAGE_LIMIT = 300;

const digits = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "");
const phoneSuffix = (phone: string | null | undefined) => digits(phone).slice(-8);

/** Chave da lista: lead vinculado ou telefone normalizado completo da conversa sem lead. */
export function conversationKey(row: Pick<MessageIndexRow, "leadId" | "phone">): string | null {
  if (row.leadId) return `lead:${row.leadId}`;
  const phone = digits(row.phone);
  return phone.length >= 8 ? `phone:${phone}` : null;
}

export function isIncomingDirection(direction: string) {
  return direction !== "outgoing" && direction !== "outbound" && direction !== "transition";
}

/**
 * Ids que precisam vir com texto e mídia: as `previewPerConversation` mais novas de cada conversa e,
 * se houver conversa aberta, as `openThreadLimit` mais novas dela (por lead ou pelo mesmo telefone).
 */
export function pickMessageIdsToLoad(
  rows: readonly MessageIndexRow[],
  options: {
    openThread?: { leadId: string | null; phone: string | null } | null;
    previewPerConversation?: number;
    openThreadLimit?: number;
  } = {},
): string[] {
  const previewPerConversation = options.previewPerConversation ?? PREVIEW_MESSAGES_PER_CONVERSATION;
  const openThreadLimit = options.openThreadLimit ?? OPEN_THREAD_MESSAGE_LIMIT;
  const newestFirst = [...rows].sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  const picked = new Set<string>();

  const perKey = new Map<string, number>();
  for (const row of newestFirst) {
    const key = conversationKey(row);
    if (!key) continue;
    const taken = perKey.get(key) ?? 0;
    if (taken >= previewPerConversation) continue;
    perKey.set(key, taken + 1);
    picked.add(row.id);
  }

  const open = options.openThread;
  if (open && (open.leadId || open.phone)) {
    const openSuffix = phoneSuffix(open.phone);
    let taken = 0;
    for (const row of newestFirst) {
      if (taken >= openThreadLimit) break;
      const sameLead = Boolean(open.leadId) && row.leadId === open.leadId;
      const samePhone = openSuffix.length === 8 && phoneSuffix(row.phone) === openSuffix;
      if (!sameLead && !samePhone) continue;
      picked.add(row.id);
      taken += 1;
    }
  }

  return [...picked];
}

/** Total e se há mensagem recebida, a partir do índice: alimentam o "N mensagens" e o filtro Atendente Virtual. */
export function summarizeIndexRows(rows: Iterable<Pick<MessageIndexRow, "id" | "direction" | "leadId" | "phone"> & Partial<Pick<MessageIndexRow, "conversationKey" | "conversationMessageCount" | "conversationHasIncoming">>>) {
  const materialized = [...rows];
  const seen = new Set<string>();
  const aggregateByConversation = new Map<string, { count: number; hasIncoming: boolean }>();
  const fallbackSeen = new Set<string>();
  let hasIncoming = false;
  for (const row of materialized) {
    if (row.conversationKey && typeof row.conversationMessageCount === "number") {
      const current = aggregateByConversation.get(row.conversationKey);
      aggregateByConversation.set(row.conversationKey, {
        count: Math.max(current?.count ?? 0, row.conversationMessageCount),
        hasIncoming: Boolean(current?.hasIncoming || row.conversationHasIncoming),
      });
      continue;
    }
  }
  for (const row of materialized) {
    const key = row.conversationKey ?? conversationKey(row);
    if (key && aggregateByConversation.has(key)) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    fallbackSeen.add(row.id);
    if (isIncomingDirection(row.direction)) hasIncoming = true;
  }
  const messageCount = [...aggregateByConversation.values()].reduce((sum, item) => sum + item.count, fallbackSeen.size);
  hasIncoming ||= [...aggregateByConversation.values()].some((item) => item.hasIncoming);
  return { messageCount, hasIncoming };
}
