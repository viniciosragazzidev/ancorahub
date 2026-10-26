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
};

/** Mensagens completas por conversa na lista: a última vira a prévia, as demais cobrem a deduplicação. */
export const PREVIEW_MESSAGES_PER_CONVERSATION = 3;
/** Histórico da conversa aberta: as mais recentes, o suficiente para a tela sem reler o lead inteiro. */
export const OPEN_THREAD_MESSAGE_LIMIT = 300;

const digits = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "");
const phoneSuffix = (phone: string | null | undefined) => digits(phone).slice(-8);

/** Mesma chave de conversa da lista: o lead quando há, senão os 8 últimos dígitos do telefone. */
export function conversationKey(row: Pick<MessageIndexRow, "leadId" | "phone">): string | null {
  if (row.leadId) return `lead:${row.leadId}`;
  const suffix = phoneSuffix(row.phone);
  return suffix.length === 8 ? `phone:${suffix}` : null;
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
export function summarizeIndexRows(rows: Iterable<Pick<MessageIndexRow, "id" | "direction">>) {
  const seen = new Set<string>();
  let hasIncoming = false;
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    if (isIncomingDirection(row.direction)) hasIncoming = true;
  }
  return { messageCount: seen.size, hasIncoming };
}
